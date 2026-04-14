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

  private readonly NOTE_STRINGS = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];

  constructor() {}

  public async start(): Promise<boolean> {
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      this.audioContext = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
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
    if (this.stream) {
      this.stream.getTracks().forEach(track => track.stop());
    }
    if (this.audioContext) {
      // Don't close context here if shared, but for simplicity:
      // this.audioContext.close(); 
    }
  }

  public getPitchData(): { pitch: number; note: string; octave: number; cents: number } | null {
    if (!this.isActive || !this.analyser || !this.audioContext) return null;

    const buffer = new Float32Array(this.analyser.fftSize);
    this.analyser.getFloatTimeDomainData(buffer);
    
    let pitch = this.autoCorrelate(buffer, this.audioContext.sampleRate);
    
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
      
      return { pitch, note, octave, cents };
    } else {
      this.pitchHistory = []; // Reset if silence
    }
    
    return null;
  }

  private autoCorrelate(buf: Float32Array, sampleRate: number): number {
    const SIZE = buf.length;
    let rms = 0;
    for (let i = 0; i < SIZE; i++) rms += buf[i] * buf[i];
    if (Math.sqrt(rms / SIZE) < 0.01) return -1;

    const c = new Array(SIZE).fill(0);
    for (let i = 0; i < SIZE; i++) {
      for (let j = 0; j < SIZE - i; j++) c[i] = c[i] + buf[j] * buf[j + i];
    }
    let d = 0; while (c[d] > c[d + 1]) d++;
    let maxval = -1, maxpos = -1;
    for (let i = d; i < SIZE; i++) {
        if (c[i] > maxval) { maxval = c[i]; maxpos = i; }
    }
    const T0 = maxpos;
    return sampleRate / T0;
  }
}
