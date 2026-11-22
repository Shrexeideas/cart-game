export class SoundEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private rattleGain: GainNode | null = null;
  private rattleFilter: BiquadFilterNode | null = null;
  private rattleLfo: OscillatorNode | null = null;
  private squeakGain: GainNode | null = null;
  private squeakOsc: OscillatorNode | null = null;
  private noiseBuffer: AudioBuffer | null = null;

  private muted = false;
  private unlocked = false;
  private reverseBeepTimer = 0;
  private lastCrashAt = 0;
  private lastBrakeAt = 0;

  public isMuted(): boolean {
    return this.muted;
  }

  public setMuted(muted: boolean): void {
    this.muted = muted;
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setTargetAtTime(muted ? 0 : 0.48, this.ctx.currentTime, 0.03);
    }
  }

  public unlock(): void {
    if (typeof window === 'undefined') return;
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return;
      this.ctx = new AudioCtx();
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = this.muted ? 0 : 0.48;
      this.masterGain.connect(this.ctx.destination);

      this.noiseBuffer = this.createNoiseBuffer(this.ctx);
      this.setupContinuousLoops(this.ctx);
    }
    if (this.ctx.state === 'suspended') {
      void this.ctx.resume();
    }
    this.unlocked = true;
  }

  private createNoiseBuffer(ctx: AudioContext): AudioBuffer {
    const length = ctx.sampleRate * 1.5;
    const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    return buffer;
  }

  private setupContinuousLoops(ctx: AudioContext): void {
    if (!this.masterGain || !this.noiseBuffer) return;

    // 1. Shopping cart wheel rattle loop
    const noiseSrc = ctx.createBufferSource();
    noiseSrc.buffer = this.noiseBuffer;
    noiseSrc.loop = true;

    this.rattleFilter = ctx.createBiquadFilter();
    this.rattleFilter.type = 'bandpass';
    this.rattleFilter.frequency.value = 340;
    this.rattleFilter.Q.value = 2.6;

    this.rattleGain = ctx.createGain();
    this.rattleGain.gain.value = 0;

    // LFO modulates rattle gain to simulate caster joints clattering over asphalt cracks
    this.rattleLfo = ctx.createOscillator();
    this.rattleLfo.type = 'triangle';
    this.rattleLfo.frequency.value = 14;
    const lfoDepth = ctx.createGain();
    lfoDepth.gain.value = 0.08;
    this.rattleLfo.connect(lfoDepth);
    lfoDepth.connect(this.rattleGain.gain);

    noiseSrc.connect(this.rattleFilter);
    this.rattleFilter.connect(this.rattleGain);
    this.rattleGain.connect(this.masterGain);
    noiseSrc.start();
    this.rattleLfo.start();

    // 2. Squeaky bad-wheel chirp oscillator
    this.squeakOsc = ctx.createOscillator();
    this.squeakOsc.type = 'sine';
    this.squeakOsc.frequency.value = 1850;
    this.squeakGain = ctx.createGain();
    this.squeakGain.gain.value = 0;
    this.squeakOsc.connect(this.squeakGain);
    this.squeakGain.connect(this.masterGain);
    this.squeakOsc.start();
  }

  public silenceLoops(): void {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.rattleGain?.gain.setTargetAtTime(0, t, 0.04);
    this.squeakGain?.gain.setTargetAtTime(0, t, 0.04);
  }

  public updateRolling(
    speed: number,
    reversing: boolean,
    wobbleActive: boolean,
    steeringMagnitude: number,
    dt: number
  ): void {
    if (!this.unlocked || !this.ctx || this.ctx.state !== 'running') return;
    const t = this.ctx.currentTime;

    const normSpeed = Math.min(1, speed / 5.5);
    const targetRattle = normSpeed > 0.06 ? 0.05 + normSpeed * 0.16 : 0;
    this.rattleGain?.gain.setTargetAtTime(targetRattle, t, 0.05);
    this.rattleFilter?.frequency.setTargetAtTime(260 + normSpeed * 520, t, 0.06);
    this.rattleLfo?.frequency.setTargetAtTime(10 + normSpeed * 28, t, 0.06);

    // Squeak intensifies with wobble or sharp turning while rolling
    const squeakPulse = Math.max(0, Math.sin(t * (wobbleActive ? 18 : 9)));
    const squeakIntensity =
      normSpeed > 0.12 && (wobbleActive || steeringMagnitude > 0.35)
        ? squeakPulse * (wobbleActive ? 0.055 : 0.022) * normSpeed
        : 0;
    this.squeakOsc?.frequency.setTargetAtTime(
      1720 + Math.sin(t * 7) * (wobbleActive ? 380 : 120),
      t,
      0.03
    );
    this.squeakGain?.gain.setTargetAtTime(squeakIntensity, t, 0.03);

    // Classic reverse beep-beep
    if (reversing && speed > 0.25) {
      this.reverseBeepTimer -= dt;
      if (this.reverseBeepTimer <= 0) {
        this.reverseBeepTimer = 0.56;
        this.playReverseBeep();
      }
    } else {
      this.reverseBeepTimer = 0.08;
    }
  }

  private playReverseBeep(): void {
    if (!this.ctx || !this.masterGain || this.muted) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'square';
    osc.frequency.setValueAtTime(980, t);
    gain.gain.setValueAtTime(0.001, t);
    gain.gain.linearRampToValueAtTime(0.055, t + 0.015);
    gain.gain.setValueAtTime(0.055, t + 0.13);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.18);
    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(t);
    osc.stop(t + 0.19);
  }

  public playBrake(speed: number): void {
    if (!this.unlocked || !this.ctx || !this.masterGain || !this.noiseBuffer || this.muted) return;
    const now = performance.now();
    if (now - this.lastBrakeAt < 240 || speed < 0.8) return;
    this.lastBrakeAt = now;

    const t = this.ctx.currentTime;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(1600, t);
    filter.frequency.exponentialRampToValueAtTime(750, t + 0.24);
    filter.Q.value = 5.5;

    const gain = this.ctx.createGain();
    const vol = Math.min(0.22, 0.06 + speed * 0.035);
    gain.gain.setValueAtTime(vol, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.26);

    src.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);
    src.start(t);
    src.stop(t + 0.27);
  }

  public playCrash(intensity = 1): void {
    if (!this.unlocked || !this.ctx || !this.masterGain || this.muted) return;
    const now = performance.now();
    if (now - this.lastCrashAt < 130) return;
    this.lastCrashAt = now;

    const t = this.ctx.currentTime;
    const vol = Math.min(0.35, 0.1 + intensity * 0.18);

    // Metallic shopping cart wire clang partials
    const freqs = [390, 685, 1140];
    freqs.forEach((f, idx) => {
      if (!this.ctx || !this.masterGain) return;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = idx === 0 ? 'triangle' : 'sine';
      osc.frequency.setValueAtTime(f * (0.94 + Math.random() * 0.12), t);
      osc.frequency.exponentialRampToValueAtTime(f * 0.72, t + 0.24);
      gain.gain.setValueAtTime(vol / (idx + 1), t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.26);
      osc.connect(gain);
      gain.connect(this.masterGain);
      osc.start(t);
      osc.stop(t + 0.27);
    });
  }

  public playBagDrop(): void {
    if (!this.unlocked || !this.ctx || !this.masterGain || !this.noiseBuffer || this.muted) return;
    const t = this.ctx.currentTime;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.value = 1400;

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.14, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.18);

    src.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);
    src.start(t);
    src.stop(t + 0.19);
  }

  public playEventAlert(): void {
    if (!this.unlocked || !this.ctx || !this.masterGain || this.muted) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(420, t);
    osc.frequency.exponentialRampToValueAtTime(760, t + 0.12);
    osc.frequency.exponentialRampToValueAtTime(510, t + 0.22);
    gain.gain.setValueAtTime(0.08, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.24);
    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(t);
    osc.stop(t + 0.25);
  }

  public playPedestrianHey(): void {
    if (!this.unlocked || !this.ctx || !this.masterGain || this.muted) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(520, t);
    osc.frequency.linearRampToValueAtTime(790, t + 0.08);
    osc.frequency.linearRampToValueAtTime(610, t + 0.18);
    gain.gain.setValueAtTime(0.11, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.2);
    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(t);
    osc.stop(t + 0.21);
  }

  public playVictory(stars: number): void {
    if (!this.unlocked || !this.ctx || !this.masterGain || this.muted) return;
    const t = this.ctx.currentTime;
    // Supermarket scanner beep + cheerful triad
    const notes = stars >= 3 ? [880, 1046.5, 1318.5, 1567.98] : [659.25, 783.99, 1046.5];
    notes.forEach((freq, i) => {
      if (!this.ctx || !this.masterGain) return;
      const start = t + i * 0.09;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = i === 0 ? 'square' : 'triangle';
      osc.frequency.setValueAtTime(freq, start);
      gain.gain.setValueAtTime(0.11, start);
      gain.gain.exponentialRampToValueAtTime(0.001, start + 0.28);
      osc.connect(gain);
      gain.connect(this.masterGain);
      osc.start(start);
      osc.stop(start + 0.3);
    });
  }

  public playFail(): void {
    if (!this.unlocked || !this.ctx || !this.masterGain || this.muted) return;
    const t = this.ctx.currentTime;
    const notes = [330, 311, 293, 240];
    notes.forEach((freq, i) => {
      if (!this.ctx || !this.masterGain) return;
      const start = t + i * 0.16;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(freq, start);
      osc.frequency.linearRampToValueAtTime(freq * 0.92, start + 0.14);
      gain.gain.setValueAtTime(0.09, start);
      gain.gain.exponentialRampToValueAtTime(0.001, start + 0.17);
      osc.connect(gain);
      gain.connect(this.masterGain);
      osc.start(start);
      osc.stop(start + 0.18);
    });
  }

  /**
   * Expressive synthesized Store Owner vocalization scaled by anger stage (1..5).
   */
  public playOwnerVoice(stage: number, isHappy = false): void {
    if (!this.unlocked || !this.ctx || !this.masterGain || this.muted) return;
    const t = this.ctx.currentTime;
    const syllables = isHappy ? 3 : stage >= 4 ? 4 : 2 + (stage % 2);
    const baseFreq = isHappy ? 210 : 145 + stage * 18;

    for (let i = 0; i < syllables; i++) {
      const start = t + i * 0.11;
      const osc = this.ctx.createOscillator();
      const filter = this.ctx.createBiquadFilter();
      const gain = this.ctx.createGain();

      osc.type = isHappy ? 'triangle' : 'sawtooth';
      const f0 = baseFreq * (0.9 + ((i * 19) % 7) * 0.04);
      osc.frequency.setValueAtTime(f0, start);
      osc.frequency.linearRampToValueAtTime(
        isHappy ? f0 * 1.22 : f0 * (i === syllables - 1 ? 1.35 : 0.85),
        start + 0.08
      );

      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(isHappy ? 950 : 680 + stage * 110, start);
      filter.Q.value = 3.2;

      const vol = isHappy ? 0.12 : 0.09 + stage * 0.022;
      gain.gain.setValueAtTime(0.001, start);
      gain.gain.linearRampToValueAtTime(vol, start + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.001, start + 0.095);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(this.masterGain);
      osc.start(start);
      osc.stop(start + 0.105);
    }
  }

  public playOwnerFootstep(): void {
    if (!this.unlocked || !this.ctx || !this.masterGain || this.muted) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(115, t);
    osc.frequency.exponentialRampToValueAtTime(48, t + 0.055);
    gain.gain.setValueAtTime(0.06, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.06);
    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(t);
    osc.stop(t + 0.065);
  }

  public playCoinChime(): void {
    if (!this.unlocked || !this.ctx || !this.masterGain || this.muted) return;
    const t = this.ctx.currentTime;
    [987.77, 1318.51].forEach((freq, i) => {
      if (!this.ctx || !this.masterGain) return;
      const start = t + i * 0.065;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, start);
      gain.gain.setValueAtTime(0.11, start);
      gain.gain.exponentialRampToValueAtTime(0.001, start + 0.22);
      osc.connect(gain);
      gain.connect(this.masterGain);
      osc.start(start);
      osc.stop(start + 0.24);
    });
  }

  public playUnlockFanfare(): void {
    if (!this.unlocked || !this.ctx || !this.masterGain || this.muted) return;
    const t = this.ctx.currentTime;
    [523.25, 659.25, 783.99, 1046.5].forEach((freq, i) => {
      if (!this.ctx || !this.masterGain) return;
      const start = t + i * 0.08;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, start);
      gain.gain.setValueAtTime(0.14, start);
      gain.gain.exponentialRampToValueAtTime(0.001, start + 0.34);
      osc.connect(gain);
      gain.connect(this.masterGain);
      osc.start(start);
      osc.stop(start + 0.36);
    });
  }

  public playMeltdownSiren(): void {
    if (!this.unlocked || !this.ctx || !this.masterGain || this.muted) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(480, t);
    osc.frequency.linearRampToValueAtTime(840, t + 0.22);
    osc.frequency.linearRampToValueAtTime(420, t + 0.44);
    gain.gain.setValueAtTime(0.1, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.46);
    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(t);
    osc.stop(t + 0.48);
  }

  public dispose(): void {
    this.silenceLoops();
    if (this.ctx) {
      void this.ctx.close();
      this.ctx = null;
    }
  }
}
