import { TickCallback } from '../types';
import { createAudioContext } from '../utils/createAudioContext';

/**
 * Metronome Core Engine
 * Atomic responsibility: Precise audio timing and state management.
 */
export class Metronome {
  private audioContext: AudioContext | null = null;
  public isPlaying: boolean = false;

  private _tempo: number = 52;
  get tempo(): number { return this._tempo; }
  set tempo(val: number) { this._tempo = Math.max(30, Math.min(250, val)); }

  private _beatsPerMeasure: number = 4;
  get beatsPerMeasure(): number { return this._beatsPerMeasure; }
  set beatsPerMeasure(val: number) { if (val >= 2 && val <= 6) this._beatsPerMeasure = val; }

  private currentBeat: number = 0;
  private nextNoteTime: number = 0.0;
  private timerWorker: Worker | null = null;
  
  private readonly LOOKAHEAD = 25.0;
  private readonly SCHEDULE_AHEAD_TIME = 0.1;

  public onTick: TickCallback | null = null;
  public onStop: (() => void) | null = null;

  constructor() {}

  public resumeContext(): void {
    this.audioContext?.resume();
  }

  private initAudio(): void {
    if (!this.audioContext) {
      this.audioContext = createAudioContext();
    }
  }

  private nextNote(): void {
    const secondsPerBeat = 60.0 / this.tempo;
    this.nextNoteTime += secondsPerBeat;
    this.currentBeat = (this.currentBeat + 1) % this.beatsPerMeasure;
  }

  private playClick(beatNumber: number, time: number): void {
    if (!this.audioContext) return;

    const osc = this.audioContext.createOscillator();
    const envelope = this.audioContext.createGain();

    osc.frequency.value = beatNumber === 0 ? 1000 : 700;
    envelope.gain.setValueAtTime(1, time);
    envelope.gain.exponentialRampToValueAtTime(0.001, time + 0.1);

    osc.connect(envelope);
    envelope.connect(this.audioContext.destination);

    osc.start(time);
    osc.stop(time + 0.1);

    // Haptic Feedback
    const hapticTime = (time - this.audioContext.currentTime) * 1000;
    setTimeout(() => {
      if (this.isPlaying && 'vibrate' in navigator) {
        navigator.vibrate(beatNumber === 0 ? [30, 30, 30] : [20]);
      }
    }, hapticTime);

    const delay = (time - this.audioContext.currentTime) * 1000;
    setTimeout(() => {
      if (this.isPlaying && this.onTick) {
        this.onTick(beatNumber);
      }
    }, delay);
  }

  private scheduler(): void {
    if (!this.audioContext) return;
    while (this.nextNoteTime < this.audioContext.currentTime + this.SCHEDULE_AHEAD_TIME) {
      this.playClick(this.currentBeat, this.nextNoteTime);
      this.nextNote();
    }
  }

  public start(): void {
    if (this.isPlaying) return;

    this.initAudio();
    // Resume in case context was suspended after a previous stop
    this.audioContext?.resume();
    this.isPlaying = true;
    this.currentBeat = 0;
    this.nextNoteTime = this.audioContext!.currentTime + 0.05;

    const workerScript = `
      let timerID = null;
      self.onmessage = (e) => {
        if (e.data === "start") {
          timerID = setInterval(() => postMessage("tick"), ${this.LOOKAHEAD});
        } else if (e.data === "stop") {
          clearInterval(timerID);
          timerID = null;
        }
      };
    `;

    const blob = new Blob([workerScript], { type: "application/javascript" });
    const workerUrl = URL.createObjectURL(blob);
    this.timerWorker = new Worker(workerUrl);
    URL.revokeObjectURL(workerUrl);
    this.timerWorker.onmessage = (e) => {
      if (e.data === "tick") this.scheduler();
    };
    this.timerWorker.postMessage("start");
  }

  public stop(): void {
    this.isPlaying = false;
    if (this.timerWorker) {
      this.timerWorker.postMessage("stop");
      this.timerWorker.terminate();
      this.timerWorker = null;
    }
    // Suspend context to free audio hardware while not playing
    this.audioContext?.suspend();
    this.onStop?.();
    this.onStop = null;
  }

  public toggle(): boolean {
    if (this.isPlaying) {
      this.stop();
    } else {
      this.start();
    }
    return this.isPlaying;
  }
}
