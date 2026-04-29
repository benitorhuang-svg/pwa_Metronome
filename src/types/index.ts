/**
 * Global Types & Interfaces
 */

export type TickCallback = (beatIndex: number) => void;

export interface UIElements {
  bpmDisplay: HTMLElement;
  bpmSlider: HTMLInputElement;
  btnMinus: HTMLButtonElement;
  btnPlus: HTMLButtonElement;
  btnPlay: HTMLButtonElement;
  playText: HTMLElement;
  playIcon: HTMLElement;
  btnTap: HTMLButtonElement;
  timeSigSelect: HTMLSelectElement;
  beatIndicators: HTMLElement;
  themeBtns: NodeListOf<HTMLButtonElement>;
  // Tuner Elements
  btnTunerStart: HTMLButtonElement;
  noteName: HTMLElement;
  noteCents: HTMLElement;
  tunerPointer: HTMLElement;
  freqDisplay: HTMLElement;
  // Navigation
  navMetronome: HTMLButtonElement;
  navTuner: HTMLButtonElement;
  pageMetronome: HTMLElement;
  pageTuner: HTMLElement;
  mainNeedle: HTMLElement;
}
