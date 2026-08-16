// Web Audio synthesizer for tactile and cartoon sound effects
class SoundEngine {
  private ctx: AudioContext | null = null;
  public enabled: boolean = true;
  public isCartoonMode: boolean = false;
  public isCartoon2Mode: boolean = false;

  private getContext(): AudioContext | null {
    if (!this.enabled) return null;
    if (!this.ctx && typeof window !== 'undefined') {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  setCartoonMode(isCartoon: boolean, isCartoon2: boolean = false) {
    this.isCartoonMode = isCartoon || isCartoon2;
    this.isCartoon2Mode = isCartoon2;
  }

  playStep() {
    if (this.isCartoon2Mode) {
      this.playCartoon2Step();
      return;
    }
    if (this.isCartoonMode) {
      this.playCartoonTap();
      return;
    }
    const ctx = this.getContext();
    if (!ctx) return;
    try {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(220, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(110, ctx.currentTime + 0.04);

      gain.gain.setValueAtTime(0.05, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.04);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start();
      osc.stop(ctx.currentTime + 0.04);
    } catch {
      // Ignore audio errors
    }
  }

  playFlex() {
    if (this.isCartoonMode) {
      this.playBoing();
      return;
    }
    this.playStep();
  }

  playTurn() {
    if (this.isCartoonMode) {
      this.playCartoonWiggle();
      return;
    }
    this.playStep();
  }

  playEat() {
    if (this.isCartoonMode) {
      this.playCartoonChomp();
      return;
    }
    const ctx = this.getContext();
    if (!ctx) return;
    try {
      const now = ctx.currentTime;
      // High bite pop
      const osc1 = ctx.createOscillator();
      const gain1 = ctx.createGain();
      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(400, now);
      osc1.frequency.exponentialRampToValueAtTime(800, now + 0.08);

      gain1.gain.setValueAtTime(0.15, now);
      gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.12);

      osc1.connect(gain1);
      gain1.connect(ctx.destination);
      osc1.start(now);
      osc1.stop(now + 0.12);

      // Crunch sound component
      const osc2 = ctx.createOscillator();
      const gain2 = ctx.createGain();
      osc2.type = 'square';
      osc2.frequency.setValueAtTime(120, now + 0.04);
      osc2.frequency.exponentialRampToValueAtTime(30, now + 0.15);

      gain2.gain.setValueAtTime(0.08, now + 0.04);
      gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.15);

      osc2.connect(gain2);
      gain2.connect(ctx.destination);
      osc2.start(now + 0.04);
      osc2.stop(now + 0.15);
    } catch {
      // Ignore audio errors
    }
  }

  playSpawnFood() {
    if (this.isCartoonMode) {
      this.playCartoonPop();
      return;
    }
    const ctx = this.getContext();
    if (!ctx) return;
    try {
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(520, now);
      osc.frequency.exponentialRampToValueAtTime(1040, now + 0.1);

      gain.gain.setValueAtTime(0.08, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + 0.1);
    } catch {
      // Ignore audio errors
    }
  }

  playEvolve() {
    if (this.isCartoonMode) {
      this.playCartoonFanfare();
      return;
    }
    const ctx = this.getContext();
    if (!ctx) return;
    try {
      const now = ctx.currentTime;
      [300, 400, 500, 600, 800].forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, now + idx * 0.05);

        gain.gain.setValueAtTime(0.06, now + idx * 0.05);
        gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.05 + 0.1);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(now + idx * 0.05);
        osc.stop(now + idx * 0.05 + 0.1);
      });
    } catch {
      // Ignore audio errors
    }
  }

  playCollide() {
    if (this.isCartoonMode) {
      this.playCartoonBonk();
      return;
    }
    const ctx = this.getContext();
    if (!ctx) return;
    try {
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(140, now);
      osc.frequency.exponentialRampToValueAtTime(40, now + 0.08);

      gain.gain.setValueAtTime(0.18, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + 0.08);
    } catch {
      // Ignore audio errors
    }
  }

  // --- SPECIFIC CARTOON SOUND EFFECTS ---

  // Classic Cartoon Spring / Boing sound (пружинка БОИНГ!)
  playBoing() {
    const ctx = this.getContext();
    if (!ctx) return;
    try {
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      // Pitch vibrato / wobble for spring effect
      osc.type = 'sine';
      osc.frequency.setValueAtTime(260, now);
      osc.frequency.exponentialRampToValueAtTime(780, now + 0.08);
      osc.frequency.exponentialRampToValueAtTime(340, now + 0.18);
      osc.frequency.exponentialRampToValueAtTime(560, now + 0.28);
      osc.frequency.exponentialRampToValueAtTime(300, now + 0.38);

      gain.gain.setValueAtTime(0.18, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.4);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + 0.4);
    } catch {
      // Ignore
    }
  }

  // Joyful Squeaky Cartoon Bite / Chomp (НЯМ-НЯМ!)
  playCartoonChomp() {
    const ctx = this.getContext();
    if (!ctx) return;
    try {
      const now = ctx.currentTime;
      // High cute bubble pop
      const osc1 = ctx.createOscillator();
      const gain1 = ctx.createGain();
      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(650, now);
      osc1.frequency.exponentialRampToValueAtTime(1400, now + 0.06);
      osc1.frequency.exponentialRampToValueAtTime(950, now + 0.12);

      gain1.gain.setValueAtTime(0.22, now);
      gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.14);

      osc1.connect(gain1);
      gain1.connect(ctx.destination);
      osc1.start(now);
      osc1.stop(now + 0.14);

      // Sweet juicy second pop
      const osc2 = ctx.createOscillator();
      const gain2 = ctx.createGain();
      osc2.type = 'triangle';
      osc2.frequency.setValueAtTime(900, now + 0.05);
      osc2.frequency.exponentialRampToValueAtTime(1600, now + 0.11);

      gain2.gain.setValueAtTime(0.15, now + 0.05);
      gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.16);

      osc2.connect(gain2);
      gain2.connect(ctx.destination);
      osc2.start(now + 0.05);
      osc2.stop(now + 0.16);
    } catch {
      // Ignore
    }
  }

  // Cartoon Slide Whistle / Whoosh (ВЖУУХ!)
  playSlideWhistle(direction: 'up' | 'down' = 'up') {
    const ctx = this.getContext();
    if (!ctx) return;
    try {
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      if (direction === 'up') {
        osc.frequency.setValueAtTime(320, now);
        osc.frequency.exponentialRampToValueAtTime(1100, now + 0.22);
      } else {
        osc.frequency.setValueAtTime(950, now);
        osc.frequency.exponentialRampToValueAtTime(280, now + 0.22);
      }

      gain.gain.setValueAtTime(0.14, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.24);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + 0.24);
    } catch {
      // Ignore
    }
  }

  // Cartoon Bonk / Squeak (БОНК! / ПИСК)
  playCartoonBonk() {
    const ctx = this.getContext();
    if (!ctx) return;
    try {
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      // Hollow wooden / rubber bonk
      osc.type = 'sine';
      osc.frequency.setValueAtTime(580, now);
      osc.frequency.exponentialRampToValueAtTime(140, now + 0.09);

      gain.gain.setValueAtTime(0.24, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.11);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + 0.11);

      // Cute squeak follower
      const sq = ctx.createOscillator();
      const sqGain = ctx.createGain();
      sq.type = 'triangle';
      sq.frequency.setValueAtTime(1200, now + 0.04);
      sq.frequency.exponentialRampToValueAtTime(800, now + 0.12);
      sqGain.gain.setValueAtTime(0.1, now + 0.04);
      sqGain.gain.exponentialRampToValueAtTime(0.001, now + 0.14);

      sq.connect(sqGain);
      sqGain.connect(ctx.destination);
      sq.start(now + 0.04);
      sq.stop(now + 0.14);
    } catch {
      // Ignore
    }
  }

  // Cartoon Pop (ПОП!)
  playCartoonPop() {
    const ctx = this.getContext();
    if (!ctx) return;
    try {
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(450, now);
      osc.frequency.exponentialRampToValueAtTime(1350, now + 0.06);

      gain.gain.setValueAtTime(0.18, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + 0.08);
    } catch {
      // Ignore
    }
  }

  // Cartoon Joyful Xylophone / Fanfare
  playCartoonFanfare() {
    const ctx = this.getContext();
    if (!ctx) return;
    try {
      const now = ctx.currentTime;
      const notes = [523.25, 659.25, 783.99, 1046.5, 1318.5]; // C5, E5, G5, C6, E6
      notes.forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, now + idx * 0.06);

        gain.gain.setValueAtTime(0.15, now + idx * 0.06);
        gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.06 + 0.14);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(now + idx * 0.06);
        osc.stop(now + idx * 0.06 + 0.14);
      });
    } catch {
      // Ignore
    }
  }

  // Cartoon Skid (ВЖЖЖИК!)
  playCartoonSkid() {
    const ctx = this.getContext();
    if (!ctx) return;
    try {
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(420, now);
      osc.frequency.linearRampToValueAtTime(180, now + 0.16);

      gain.gain.setValueAtTime(0.12, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + 0.18);
    } catch {
      // Ignore
    }
  }

  // Cartoon Tap
  playCartoonTap() {
    const ctx = this.getContext();
    if (!ctx) return;
    try {
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(480, now);
      osc.frequency.exponentialRampToValueAtTime(240, now + 0.035);

      gain.gain.setValueAtTime(0.07, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.035);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + 0.035);
    } catch {
      // Ignore
    }
  }

  // Cartoon Wiggle
  playCartoonWiggle() {
    const ctx = this.getContext();
    if (!ctx) return;
    try {
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(320, now);
      osc.frequency.exponentialRampToValueAtTime(480, now + 0.04);
      osc.frequency.exponentialRampToValueAtTime(340, now + 0.08);

      gain.gain.setValueAtTime(0.08, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.09);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + 0.09);
    } catch {
      // Ignore
    }
  }

  // --- CARTOON 2 EXCLUSIVE SOUND EFFECTS ---
  playCartoon2Step() {
    const ctx = this.getContext();
    if (!ctx) return;
    try {
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      // Funky high bubble xylophone bloop
      const pitches = [587.33, 659.25, 783.99, 880.0, 1046.5];
      const p = pitches[Math.floor(Math.random() * pitches.length)];
      osc.type = 'sine';
      osc.frequency.setValueAtTime(p, now);
      osc.frequency.exponentialRampToValueAtTime(p * 1.5, now + 0.025);
      osc.frequency.exponentialRampToValueAtTime(p * 0.8, now + 0.045);

      gain.gain.setValueAtTime(0.09, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.045);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + 0.045);
    } catch {
      // Ignore
    }
  }

  playCartoon2Chomp() {
    const ctx = this.getContext();
    if (!ctx) return;
    try {
      const now = ctx.currentTime;
      // Hyper sparkly high-pitched chomp + glitter arpeggio
      const notes = [880, 1174.66, 1396.91, 1760];
      notes.forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, now + idx * 0.025);
        osc.frequency.exponentialRampToValueAtTime(freq * 1.4, now + idx * 0.025 + 0.05);

        gain.gain.setValueAtTime(0.18, now + idx * 0.025);
        gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.025 + 0.07);

        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now + idx * 0.025);
        osc.stop(now + idx * 0.025 + 0.07);
      });
    } catch {
      // Ignore
    }
  }

  playCartoon2Dash() {
    const ctx = this.getContext();
    if (!ctx) return;
    try {
      const now = ctx.currentTime;
      // Fast turbo retro synthesizer ascending slide
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(300, now);
      osc.frequency.exponentialRampToValueAtTime(1400, now + 0.2);

      gain.gain.setValueAtTime(0.12, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.22);
    } catch {
      // Ignore
    }
  }

  playCartoon2Brake() {
    const ctx = this.getContext();
    if (!ctx) return;
    try {
      const now = ctx.currentTime;
      // Funny cartoon squeaky rubber tire screech
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(950, now);
      osc.frequency.linearRampToValueAtTime(320, now + 0.18);

      gain.gain.setValueAtTime(0.15, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.2);
    } catch {
      // Ignore
    }
  }

  playCartoon2Fanfare() {
    const ctx = this.getContext();
    if (!ctx) return;
    try {
      const now = ctx.currentTime;
      const notes = [523.25, 659.25, 783.99, 1046.5, 1318.5, 1567.98]; // C5, E5, G5, C6, E6, G6
      notes.forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, now + idx * 0.04);

        gain.gain.setValueAtTime(0.16, now + idx * 0.04);
        gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.04 + 0.18);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(now + idx * 0.04);
        osc.stop(now + idx * 0.04 + 0.18);
      });
    } catch {
      // Ignore
    }
  }
}

export const soundFx = new SoundEngine();

