import { Metronome } from '../core/Metronome';
import { Tuner } from '../core/Tuner';
import { UIElements } from '../types';
 
// Define Screen Wake Lock types since they might be missing in some TS environments
interface WakeLockSentinel extends EventTarget {
  released: boolean;
  type: 'screen';
  release(): Promise<void>;
  onrelease: EventListener | null;
}

export class UIController {
  private elements: UIElements;
  private metronome: Metronome;
  private tuner: Tuner;
  private wakeLock: WakeLockSentinel | null = null;
  private animationFrameId: number | null = null;

  constructor(metronome: Metronome, tuner: Tuner) {
    this.metronome = metronome;
    this.tuner = tuner;
    this.elements = {
      bpmDisplay: document.getElementById('bpm-display')!,
      bpmSlider: document.getElementById('bpm-slider') as HTMLInputElement,
      btnMinus: document.getElementById('btn-minus') as HTMLButtonElement,
      btnPlus: document.getElementById('btn-plus') as HTMLButtonElement,
      btnPlay: document.getElementById('btn-play') as HTMLButtonElement,
      playText: document.getElementById('play-text')!,
      playIcon: document.getElementById('play-icon')!,
      btnTap: document.getElementById('btn-tap') as HTMLButtonElement,
      timeSigSelect: document.getElementById('time-signature-select') as HTMLSelectElement,
      beatIndicators: document.getElementById('beat-indicators')!,
      themeBtns: document.querySelectorAll('.theme-btn') as NodeListOf<HTMLButtonElement>,
      // Tuner
      btnTunerStart: document.getElementById('btn-tuner-start') as HTMLButtonElement,
      noteName: document.getElementById('note-name')!,
      noteCents: document.getElementById('note-cents')!,
      tunerPointer: document.getElementById('tuner-pointer')!,
      freqDisplay: document.getElementById('freq-display')!,
      // Nav
      navMetronome: document.getElementById('nav-metronome') as HTMLButtonElement,
      navTuner: document.getElementById('nav-tuner') as HTMLButtonElement,
      pageMetronome: document.getElementById('page-metronome')!,
      pageTuner: document.getElementById('page-tuner')!,
      mainNeedle: document.getElementById('main-needle')!
    };

    this.init();
  }

  private init(): void {
    this.createBeatDots();
    this.bindEvents();
    this.bindThemeEvents();
    this.bindNavEvents();
    this.bindTunerEvents();
    
    this.metronome.onTick = (index) => this.handleTick(index);
  }

  private bindNavEvents(): void {
    this.elements.navMetronome.onclick = () => this.showPage('metronome');
    this.elements.navTuner.onclick = () => this.showPage('tuner');
  }

  private showPage(page: 'metronome' | 'tuner'): void {
    if (page === 'metronome') {
      this.elements.pageMetronome.classList.remove('hidden');
      this.elements.pageTuner.classList.add('hidden');
      this.elements.navMetronome.classList.add('active');
      this.elements.navTuner.classList.remove('active');
      if (this.tuner.isActive) this.toggleTuner();
    } else {
      this.elements.pageMetronome.classList.add('hidden');
      this.elements.pageTuner.classList.remove('hidden');
      this.elements.navMetronome.classList.remove('active');
      this.elements.navTuner.classList.add('active');
      if (this.metronome.isPlaying) this.togglePlay();
    }
  }

  private bindThemeEvents(): void {
    this.elements.themeBtns.forEach(btn => {
      btn.onclick = () => {
        const theme = btn.getAttribute('data-theme')!;
        this.elements.themeBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        document.body.setAttribute('data-theme', theme);
      };
    });
  }

  private bindTunerEvents(): void {
    this.elements.btnTunerStart.onclick = () => this.toggleTuner();
  }

  private async toggleTuner(): Promise<void> {
    if (this.tuner.isActive) {
      this.tuner.stop();
      this.stopUIAnimate();
      this.elements.btnTunerStart.classList.remove('active');
      this.elements.btnTunerStart.innerHTML = '<div class="mic-dot"></div> START MIC';
      this.elements.noteName.innerText = '';
      this.elements.noteCents.innerText = 'Waiting for input';
      this.elements.mainNeedle.style.transform = 'translateX(-50%) rotate(-90deg)';
      this.elements.tunerPointer.style.left = '50%';
    } else {
      const success = await this.tuner.start();
      if (success) {
        this.elements.btnTunerStart.classList.add('active');
        this.elements.btnTunerStart.innerHTML = '<div class="mic-dot"></div> STOP MIC';
        this.startUIAnimate();
      }
    }
  }

  private startUIAnimate(): void {
    if (this.animationFrameId) return;
    const animate = () => {
      if (this.tuner.isActive) this.updateTunerUI();
      // You could also add dynamic background breathing here
      this.animationFrameId = requestAnimationFrame(animate);
    };
    this.animationFrameId = requestAnimationFrame(animate);
  }

  private stopUIAnimate(): void {
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
  }

  private updateTunerUI(): void {
    const data = this.tuner.getPitchData();
    if (data) {
      this.elements.noteName.innerText = data.note;
      this.elements.noteCents.innerText = `${data.cents > 0 ? '+' : ''}${data.cents} cents`;
      this.elements.freqDisplay.innerText = `${data.pitch.toFixed(2)} Hz`;
      
      const percentage = (data.cents + 50);
      this.elements.tunerPointer.style.left = `${percentage}%`;
      
      // Rotate needle: -50 to +50 cents maps to -90 to +90 degrees
      const rotation = (data.cents / 50) * 80; 
      this.elements.mainNeedle.style.transform = `translateX(-50%) rotate(${rotation}deg)`;

      if (Math.abs(data.cents) < 5) {
        this.elements.noteName.style.color = 'var(--accent-blue)';
      } else {
        this.elements.noteName.style.color = '#fff';
      }
    } else {
      // Idle state: Needle lies flat
      this.elements.mainNeedle.style.transform = 'translateX(-50%) rotate(-90deg)';
      this.elements.noteName.innerText = '';
    }
  }

  private bindEvents(): void {
    this.elements.bpmSlider.oninput = (e) => this.updateBPM((e.target as HTMLInputElement).value);
    this.elements.btnMinus.onclick = () => this.updateBPM(this.metronome.tempo - 1);
    this.elements.btnPlus.onclick = () => this.updateBPM(this.metronome.tempo + 1);
    this.elements.btnPlay.onclick = () => this.togglePlay();
    this.elements.btnTap.onclick = () => this.handleTap();
    this.elements.timeSigSelect.onchange = (e) => {
        this.metronome.beatsPerMeasure = parseInt((e.target as HTMLSelectElement).value);
        this.createBeatDots();
    };
  }

  private updateBPM(val: string | number): void {
    const bpm = typeof val === 'string' ? parseInt(val) : val;
    this.metronome.tempo = bpm;
    this.elements.bpmDisplay.innerText = bpm.toString();
    this.elements.bpmSlider.value = bpm.toString();
  }

  private togglePlay(): void {
    const isPlaying = this.metronome.toggle();
    this.elements.btnPlay.classList.toggle('playing', isPlaying);
    this.elements.playText.innerText = isPlaying ? 'STOP' : 'START';
    this.elements.playIcon.className = isPlaying ? 'icon-square' : 'icon-play';
    
    if (isPlaying) {
        this.requestWakeLock();
    } else {
        this.releaseWakeLock();
        this.resetBeatDots();
    }
  }

  private async requestWakeLock() {
    if ('wakeLock' in navigator) {
      try {
        const nav = navigator as Navigator & { wakeLock: { request(type: 'screen'): Promise<WakeLockSentinel> } };
        this.wakeLock = await nav.wakeLock.request('screen');
      } catch (err) {
        if (err instanceof Error) {
            console.error(`${err.name}, ${err.message}`);
        }
      }
    }
  }

  private releaseWakeLock() {
    if (this.wakeLock) {
      this.wakeLock.release().then(() => {
        this.wakeLock = null;
      });
    }
  }

  private lastTap = 0;
  private handleTap(): void {
    const now = Date.now();
    if (this.lastTap) {
      const bpm = Math.round(60000 / (now - this.lastTap));
      if (bpm >= 30 && bpm <= 250) this.updateBPM(bpm);
    }
    this.lastTap = now;
  }

  private createBeatDots(): void {
    this.elements.beatIndicators.innerHTML = '';
    for (let i = 0; i < this.metronome.beatsPerMeasure; i++) {
      const dot = document.createElement('div');
      dot.className = 'beat-dot';
      this.elements.beatIndicators.appendChild(dot);
    }
  }

  private handleTick(index: number): void {
    const dots = this.elements.beatIndicators.children;
    for (let i = 0; i < dots.length; i++) {
        const dot = dots[i] as HTMLElement;
        dot.classList.toggle('active', i === index);
        dot.classList.toggle('first-beat', i === 0 && i === index);
    }
  }

  private resetBeatDots(): void {
    const dots = this.elements.beatIndicators.children;
    for (let i = 0; i < dots.length; i++) {
        const dot = dots[i] as HTMLElement;
        dot.classList.remove('active');
    }
  }
}
