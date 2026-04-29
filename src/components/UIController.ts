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
  private isTunerTransitioning = false;
  private bpmSaveTimer: ReturnType<typeof setTimeout> | null = null;
  private beatDots: HTMLElement[] = [];
  private tunerBtnText: Text | null = null;
  private static readonly VALID_TIME_SIGS: ReadonlyArray<number> = [2, 3, 4, 5, 6];

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
    this.initTunerBtnContent();
    this.restoreState();
    this.setupVisibilityHandler();
    this.setupIOSAudioResume();
    this.setupKeyboardShortcuts();

    this.metronome.onTick = (index) => this.handleTick(index);
  }

  private restoreState(): void {
    const savedBPM = parseInt(localStorage.getItem('metronome-bpm') ?? '', 10);
    if (!isNaN(savedBPM) && savedBPM >= 30 && savedBPM <= 250) {
      this.updateBPM(savedBPM);
    }
    const savedTimeSig = parseInt(localStorage.getItem('metronome-timesig') ?? '', 10);
    if (UIController.VALID_TIME_SIGS.includes(savedTimeSig)) {
      this.metronome.beatsPerMeasure = savedTimeSig;
      this.elements.timeSigSelect.value = savedTimeSig.toString();
      this.createBeatDots();
    }
  }

  private setupKeyboardShortcuts(): void {
    document.addEventListener('keydown', (e) => {
      // Ignore shortcuts when focus is inside an input/select
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLSelectElement) return;
      switch (e.key) {
        case ' ':
          e.preventDefault();
          if (!this.elements.pageMetronome.classList.contains('hidden')) {
            this.togglePlay();
          }
          break;
        case 'ArrowUp':
          e.preventDefault();
          this.updateBPM(this.metronome.tempo + 1);
          break;
        case 'ArrowDown':
          e.preventDefault();
          this.updateBPM(this.metronome.tempo - 1);
          break;
      }
    });
  }

  private setupVisibilityHandler(): void {
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible' && this.metronome.isPlaying) {
        this.requestWakeLock();
      }
    });
  }

  private setupIOSAudioResume(): void {
    const resume = () => {
      this.metronome.resumeContext();
      this.tuner.resumeContext();
      document.removeEventListener('touchstart', resume);
    };
    document.addEventListener('touchstart', resume, { passive: true });
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
      this.elements.navMetronome.setAttribute('aria-current', 'page');
      this.elements.navTuner.removeAttribute('aria-current');
      if (this.tuner.isActive) this.toggleTuner();
    } else {
      this.elements.pageMetronome.classList.add('hidden');
      this.elements.pageTuner.classList.remove('hidden');
      this.elements.navMetronome.classList.remove('active');
      this.elements.navTuner.classList.add('active');
      this.elements.navTuner.setAttribute('aria-current', 'page');
      this.elements.navMetronome.removeAttribute('aria-current');
      if (this.metronome.isPlaying) this.togglePlay();
      // Reset needle to idle when entering tuner page
      this.elements.mainNeedle.style.transform = 'translateX(-50%) rotate(-90deg)';
      this.elements.tunerPointer.style.left = '50%';
    }
  }

  private static readonly THEME_COLORS: Record<string, string> = {
    spring: '#061a11',
    pink:   '#1a0f14',
    winter: '#0f172a',
    autumn: '#1a120b',
  };

  private static readonly THEME_IMAGES: Record<string, string> = {
    spring: 'spring.png',
    pink:   'pink.png',
    winter: 'winter.png',
    autumn: 'autumn.png',
  };

  private applyThemeImage(theme: string): void {
    const img = UIController.THEME_IMAGES[theme] ?? 'spring.png';
    const base = import.meta.env.BASE_URL;
    document.documentElement.style.setProperty(
      '--bg-image',
      `url('${base}assets/${img}')`
    );
  }

  private bindThemeEvents(): void {
    const savedTheme = localStorage.getItem('metronome-theme');
    if (savedTheme) {
      document.body.setAttribute('data-theme', savedTheme);
    }
    // Apply the correct bg-image using runtime BASE_URL
    this.applyThemeImage(savedTheme ?? 'spring');
    // Initialise aria-pressed on all theme buttons
    this.elements.themeBtns.forEach(b => {
      const isActive = b.getAttribute('data-theme') === (savedTheme ?? 'spring');
      b.classList.toggle('active', isActive);
      b.setAttribute('aria-pressed', String(isActive));
    });

    this.elements.themeBtns.forEach(btn => {
      btn.onclick = () => {
        const theme = btn.getAttribute('data-theme')!;
        this.elements.themeBtns.forEach(b => {
          b.classList.remove('active');
          b.setAttribute('aria-pressed', 'false');
        });
        btn.classList.add('active');
        btn.setAttribute('aria-pressed', 'true');
        document.body.setAttribute('data-theme', theme);
        localStorage.setItem('metronome-theme', theme);
        this.applyThemeImage(theme);
        // Keep PWA theme-color meta in sync with the active theme
        const metaThemeColor = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
        if (metaThemeColor) {
          metaThemeColor.content = UIController.THEME_COLORS[theme] ?? '#161e2e';
        }
      };
    });
  }

  private bindTunerEvents(): void {
    this.elements.btnTunerStart.onclick = () => this.toggleTuner();
  }

  private initTunerBtnContent(): void {
    const btn = this.elements.btnTunerStart;
    btn.childNodes.forEach(n => {
      if (n.nodeType === Node.TEXT_NODE && n.textContent?.trim()) {
        this.tunerBtnText = n as Text;
        n.textContent = ' START MIC';
      }
    });
  }

  private async toggleTuner(): Promise<void> {
    if (this.isTunerTransitioning) return;
    this.isTunerTransitioning = true;
    try {
      if (this.tuner.isActive) {
        this.tuner.stop();
        this.stopUIAnimate();
        this.elements.btnTunerStart.classList.remove('active');
        this.setBtnTunerLabel(false);
        this.elements.noteName.textContent = '';
        this.elements.noteName.style.color = '';
        this.elements.noteName.classList.remove('in-tune');
        this.elements.noteCents.textContent = 'Waiting for input';
        this.elements.freqDisplay.textContent = '0.00 Hz';
        this.elements.mainNeedle.style.transform = 'translateX(-50%) rotate(-90deg)';
        this.elements.tunerPointer.style.left = '50%';
      } else {
        const success = await this.tuner.start();
        if (success) {
          this.elements.btnTunerStart.classList.add('active');
          this.setBtnTunerLabel(true);
          this.startUIAnimate();
        }
      }
    } finally {
      this.isTunerTransitioning = false;
    }
  }

  private setBtnTunerLabel(active: boolean): void {
    if (this.tunerBtnText) {
      this.tunerBtnText.textContent = active ? ' STOP MIC' : ' START MIC';
    }
  }

  private startUIAnimate(): void {
    if (this.animationFrameId) return;
    
    const animate = () => {
      if (this.tuner.isActive) {
        this.updateTunerUI();
        this.animationFrameId = requestAnimationFrame(animate);
      } else {
        this.animationFrameId = null;
      }
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
      this.elements.noteName.textContent = data.note;
      this.elements.noteCents.textContent = `${data.cents > 0 ? '+' : ''}${data.cents} cents`;
      this.elements.freqDisplay.textContent = `${data.pitch.toFixed(2)} Hz`;
      
      const percentage = (data.cents + 50);
      this.elements.tunerPointer.style.left = `${percentage}%`;
      
      // Rotate needle: -50 to +50 cents maps to -90 to +90 degrees
      const rotation = (data.cents / 50) * 80; 
      this.elements.mainNeedle.style.transform = `translateX(-50%) rotate(${rotation}deg)`;

      // Toggle CSS class instead of mutating inline style (avoids forced style recalc)
      this.elements.noteName.classList.toggle('in-tune', Math.abs(data.cents) < 5);
    } else {
      // Idle state: Needle lies flat
      this.elements.mainNeedle.style.transform = 'translateX(-50%) rotate(-90deg)';
      this.elements.noteName.textContent = '';
      this.elements.noteName.classList.remove('in-tune');
    }
  }

  private bindEvents(): void {
    this.elements.bpmSlider.oninput = (e) => this.updateBPM((e.target as HTMLInputElement).value);
    this.elements.btnMinus.onclick = () => this.updateBPM(this.metronome.tempo - 1);
    this.elements.btnPlus.onclick = () => this.updateBPM(this.metronome.tempo + 1);
    this.elements.btnPlay.onclick = () => this.togglePlay();
    this.elements.btnTap.onclick = () => this.handleTap();
    this.setupLongPress(this.elements.btnMinus, () => this.updateBPM(this.metronome.tempo - 1));
    this.setupLongPress(this.elements.btnPlus, () => this.updateBPM(this.metronome.tempo + 1));
    this.elements.timeSigSelect.onchange = (e) => {
        const beats = parseInt((e.target as HTMLSelectElement).value, 10);
        if (UIController.VALID_TIME_SIGS.includes(beats)) {
          this.metronome.beatsPerMeasure = beats;
          this.createBeatDots();
          localStorage.setItem('metronome-timesig', beats.toString());
        }
    };
  }

  private updateBPM(val: string | number): void {
    const bpm = typeof val === 'string' ? parseInt(val, 10) : val;
    if (isNaN(bpm)) return;
    const clamped = Math.max(30, Math.min(250, bpm));
    this.metronome.tempo = clamped;
    this.elements.bpmDisplay.textContent = clamped.toString();
    this.elements.bpmSlider.value = clamped.toString();
    // Debounce localStorage writes to avoid excessive I/O during slider drag
    if (this.bpmSaveTimer) clearTimeout(this.bpmSaveTimer);
    this.bpmSaveTimer = setTimeout(() => {
      localStorage.setItem('metronome-bpm', clamped.toString());
      this.bpmSaveTimer = null;
    }, 300);
  }

  private togglePlay(): void {
    const isPlaying = this.metronome.toggle();
    this.elements.btnPlay.classList.toggle('playing', isPlaying);
    this.elements.playText.textContent = isPlaying ? 'STOP' : 'START';
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

  private setupLongPress(btn: HTMLButtonElement, action: () => void): void {
    let intervalId: ReturnType<typeof setInterval> | null = null;
    let timeoutId: ReturnType<typeof setTimeout> | null = null;

    const start = () => {
      timeoutId = setTimeout(() => {
        intervalId = setInterval(action, 80);
      }, 400);
    };
    const stop = () => {
      if (timeoutId) { clearTimeout(timeoutId); timeoutId = null; }
      if (intervalId) { clearInterval(intervalId); intervalId = null; }
    };

    btn.addEventListener('mousedown', start);
    btn.addEventListener('touchstart', start, { passive: true });
    btn.addEventListener('mouseup', stop);
    btn.addEventListener('mouseleave', stop);
    btn.addEventListener('touchend', stop);
    btn.addEventListener('touchcancel', stop);
  }

  private releaseWakeLock(): void {
    if (this.wakeLock) {
      this.wakeLock.release().then(() => {
        this.wakeLock = null;
      }).catch((err) => {
        if (err instanceof Error) console.error(`WakeLock release failed: ${err.message}`);
        this.wakeLock = null;
      });
    }
  }

  private tapTimes: number[] = [];
  private handleTap(): void {
    const now = Date.now();
    // Reset if idle for more than 3 seconds
    if (this.tapTimes.length > 0 && now - this.tapTimes[this.tapTimes.length - 1] > 3000) {
      this.tapTimes = [];
    }
    this.tapTimes.push(now);
    // Keep only last 6 taps
    if (this.tapTimes.length > 6) this.tapTimes.shift();
    if (this.tapTimes.length >= 2) {
      let totalInterval = 0;
      for (let i = 1; i < this.tapTimes.length; i++) {
        totalInterval += this.tapTimes[i] - this.tapTimes[i - 1];
      }
      const avgInterval = totalInterval / (this.tapTimes.length - 1);
      const bpm = Math.round(60000 / avgInterval);
      if (bpm >= 30 && bpm <= 250) this.updateBPM(bpm);
    }
  }

  private createBeatDots(): void {
    this.elements.beatIndicators.innerHTML = '';
    this.beatDots = [];
    for (let i = 0; i < this.metronome.beatsPerMeasure; i++) {
      const dot = document.createElement('div');
      dot.className = 'beat-dot';
      this.elements.beatIndicators.appendChild(dot);
      this.beatDots.push(dot);
    }
  }

  private prevTickIndex: number = -1;
  private handleTick(index: number): void {
    if (this.prevTickIndex >= 0 && this.prevTickIndex < this.beatDots.length) {
      this.beatDots[this.prevTickIndex].classList.remove('active', 'first-beat');
    }
    if (index < this.beatDots.length) {
      this.beatDots[index].classList.add('active');
      if (index === 0) this.beatDots[index].classList.add('first-beat');
    }
    this.prevTickIndex = index;
  }

  private resetBeatDots(): void {
    for (const dot of this.beatDots) {
      dot.classList.remove('active', 'first-beat');
    }
  }
}
