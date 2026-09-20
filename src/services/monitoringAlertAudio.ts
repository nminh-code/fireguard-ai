class MonitoringAlertAudio {
  private context: AudioContext | null = null;
  private enabled = false;

  public isEnabled(): boolean {
    return this.enabled && this.context?.state === 'running';
  }

  public async enable(): Promise<boolean> {
    try {
      if (!this.context) {
        const AudioContextClass = window.AudioContext ||
          (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        if (!AudioContextClass) return false;
        this.context = new AudioContextClass();
      }
      if (this.context.state === 'suspended') await this.context.resume();
      this.enabled = this.context.state === 'running';
      if (this.enabled) this.playTone('smoke', true);
      return this.enabled;
    } catch {
      this.enabled = false;
      return false;
    }
  }

  public playAlert(type: 'fire' | 'smoke'): boolean {
    if (!this.isEnabled()) return false;
    this.playTone(type, false);
    return true;
  }

  private playTone(type: 'fire' | 'smoke', confirmation: boolean): void {
    const context = this.context;
    if (!context || context.state !== 'running') return;
    const start = context.currentTime;
    const duration = confirmation ? 0.16 : 0.75;
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = type === 'fire' ? 'sawtooth' : 'sine';
    oscillator.frequency.setValueAtTime(confirmation ? 660 : type === 'fire' ? 880 : 520, start);
    if (!confirmation) {
      oscillator.frequency.linearRampToValueAtTime(type === 'fire' ? 1320 : 760, start + duration / 2);
      oscillator.frequency.linearRampToValueAtTime(type === 'fire' ? 880 : 520, start + duration);
    }
    gain.gain.setValueAtTime(confirmation ? 0.04 : 0.14, start);
    gain.gain.exponentialRampToValueAtTime(0.001, start + duration);
    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start(start);
    oscillator.stop(start + duration);
  }
}

export const monitoringAlertAudio = new MonitoringAlertAudio();
