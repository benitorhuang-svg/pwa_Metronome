import { createAudioContext } from '../utils/createAudioContext';

/**
 * Tuner Core Engine
 * Handles microphone input and pitch detection using Auto-correlation (YIN).
 */
export class Tuner {
  private audioContext: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private stream: MediaStream | null = null;
  public isActive: boolean = false;
  private pitchHistory: number[] = [];
  private readonly HISTORY_SIZE = 5;
  private frameCount: number = 0;
  private readonly THROTTLE_FRAMES = 4;
  private lastPitchData: { pitch: number; note: string; octave: number; cents: number } | null = null;

  private readonly NOTE_STRINGS = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
  private buffer: Float32Array<ArrayBuffer> = new Float32Array(4096);

  constructor() {}

  public async start(): Promise<boolean> {
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      this.audioContext = createAudioContext();
      const source = this.audioContext.createMediaStreamSource(this.stream);
      this.analyser = this.audioContext.createAnalyser();
      this.analyser.fftSize = 4096;
      source.connect(this.analyser);
      this.isActive = true;
      return true;
    } catch (err) {
      console.error('Tuner initialization failed', err);
      return false;
    }
  }

  public stop(): void {
    this.isActive = false;
    this.pitchHistory = [];
    this.frameCount = 0;
    this.lastPitchData = null;
    if (this.stream) {
      this.stream.getTracks().forEach(track => track.stop());
      this.stream = null;
    }
    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }
    this.analyser = null;
  }

  public getPitchData(): { pitch: number; note: string; octave: number; cents: number } | null {
    if (!this.isActive || !this.analyser || !this.audioContext) return null;

    // Throttle: run pitch detection every THROTTLE_FRAMES frames to reduce CPU load.
    // On skipped frames, return the last known result so the UI doesn't flicker to idle.
    this.frameCount++;
    if (this.frameCount % this.THROTTLE_FRAMES !== 0) return this.lastPitchData;

    if (this.buffer.length !== this.analyser.fftSize) {
      this.buffer = new Float32Array(this.analyser.fftSize) as Float32Array<ArrayBuffer>;
    }
    this.analyser.getFloatTimeDomainData(this.buffer);
    
    let pitch = this.autoCorrelate(this.buffer, this.audioContext.sampleRate);
    
    if (pitch !== -1) {
      this.pitchHistory.push(pitch);
      if (this.pitchHistory.length > this.HISTORY_SIZE) this.pitchHistory.shift();
      
      // Use average for smoothing
      pitch = this.pitchHistory.reduce((a, b) => a + b) / this.pitchHistory.length;

      const noteNum = 12 * (Math.log(pitch / 440) / Math.log(2)) + 69;
      const roundedNote = Math.round(noteNum);
      const cents = Math.floor((noteNum - roundedNote) * 100);
      const note = this.NOTE_STRINGS[roundedNote % 12];
      const octave = Math.floor(roundedNote / 12) - 1;
      
      this.lastPitchData = { pitch, note, octave, cents };
      return this.lastPitchData;
    } else {
      this.pitchHistory = []; // Reset if silence
      this.lastPitchData = null;
    }
    
    return null;
  }

  private autoCorrelate(buf: Float32Array, sampleRate: number): number {
    const SIZE = buf.length;
    let rms = 0;
    for (let i = 0; i < SIZE; i++) rms += buf[i] * buf[i];
    if (Math.sqrt(rms / SIZE) < 0.01) return -1;

    // Limit lag search to human pitch range: ~80 Hz – 1200 Hz
    const minLag = Math.floor(sampleRate / 1200);
    const maxLag = Math.min(Math.ceil(sampleRate / 80), SIZE - 1);

    const c = new Float32Array(maxLag + 1);
    for (let i = minLag; i <= maxLag; i++) {
      let sum = 0;
      for (let j = 0; j < SIZE - i; j++) sum += buf[j] * buf[j + i];
      c[i] = sum;
    }

    let d = minLag; while (d < maxLag && c[d] > c[d + 1]) d++;
    let maxval = -1, maxpos = -1;
    for (let i = d; i <= maxLag; i++) {
      if (c[i] > maxval) { maxval = c[i]; maxpos = i; }
    }

    if (maxpos <= 0) return -1;

    // Parabolic interpolation: refine the integer lag to sub-sample precision.
    // Without this, high-frequency notes jump between discrete pitch values
    // (e.g. at 44100 Hz, integer lags near 40 correspond to ~30 Hz gaps).
    let refinedPos = maxpos;
    if (maxpos > minLag && maxpos < maxLag) {
      const alpha = c[maxpos - 1];
      const beta  = c[maxpos];
      const gamma = c[maxpos + 1];
      const denom = 2 * (alpha - 2 * beta + gamma);
      if (denom !== 0) {
        refinedPos = maxpos - (gamma - alpha) / denom;
      }
    }

    return sampleRate / refinedPos;
  }
}
