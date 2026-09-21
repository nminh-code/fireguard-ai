import fireAlarmUrl from '../assets/fire-alarm.mp3';

interface AlertSoundIdentity {
  id: string;
  sequence: number;
  class: 'fire' | 'smoke';
}

const MAX_HANDLED_ALERTS = 200;

class MonitoringAlertAudio {
  private audio: HTMLAudioElement | null = null;
  private handledAlertKeys = new Set<string>();
  private pendingAlertKey: string | null = null;
  private enabled = true;
  private unlocked = false;
  private unlocking = false;

  public isEnabled(): boolean {
    return this.enabled;
  }

  public setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    if (!enabled) {
      this.pendingAlertKey = null;
      if (this.audio) {
        this.audio.pause();
        this.audio.currentTime = 0;
      }
      return;
    }
    void this.handleUserInteraction();
  }

  public bindUserInteraction(): () => void {
    if (typeof window === 'undefined') return () => {};
    this.getAudio()?.load();
    const handleInteraction = () => { void this.handleUserInteraction(); };
    window.addEventListener('pointerdown', handleInteraction, true);
    window.addEventListener('keydown', handleInteraction, true);
    window.addEventListener('touchstart', handleInteraction, true);
    return () => {
      window.removeEventListener('pointerdown', handleInteraction, true);
      window.removeEventListener('keydown', handleInteraction, true);
      window.removeEventListener('touchstart', handleInteraction, true);
    };
  }

  public handleAlert(alert: AlertSoundIdentity): void {
    if (alert.class !== 'fire') return;
    const alertKey = `${alert.id}:${alert.sequence}`;
    if (this.handledAlertKeys.has(alertKey)) return;
    this.remember(alertKey);
    if (!this.enabled) return;
    this.pendingAlertKey = alertKey;
    void this.play(alertKey);
  }

  private getAudio(): HTMLAudioElement | null {
    if (typeof Audio === 'undefined') return null;
    if (!this.audio) {
      this.audio = new Audio(fireAlarmUrl);
      this.audio.preload = 'auto';
      this.audio.loop = false;
    }
    return this.audio;
  }

  private async play(alertKey: string): Promise<void> {
    if (!this.enabled) return;
    const audio = this.getAudio();
    if (!audio) return;
    try {
      audio.muted = false;
      audio.currentTime = 0;
      await audio.play();
      this.unlocked = true;
      if (this.pendingAlertKey === alertKey) this.pendingAlertKey = null;
    } catch {
      // Keep this fire alert pending; the next user gesture retries playback.
    }
  }

  private async handleUserInteraction(): Promise<void> {
    if (!this.enabled || this.unlocking) return;
    const pendingAlertKey = this.pendingAlertKey;
    if (pendingAlertKey) {
      await this.play(pendingAlertKey);
      return;
    }
    if (this.unlocked) return;
    const audio = this.getAudio();
    if (!audio) return;
    this.unlocking = true;
    try {
      audio.muted = true;
      audio.currentTime = 0;
      await audio.play();
      audio.pause();
      audio.currentTime = 0;
      this.unlocked = true;
    } catch {
      // A later user gesture can retry the unlock.
    } finally {
      audio.muted = false;
      this.unlocking = false;
    }
  }

  private remember(alertKey: string): void {
    this.handledAlertKeys.add(alertKey);
    if (this.handledAlertKeys.size <= MAX_HANDLED_ALERTS) return;
    const oldestKey = this.handledAlertKeys.values().next().value;
    if (oldestKey) this.handledAlertKeys.delete(oldestKey);
  }
}

export const monitoringAlertAudio = new MonitoringAlertAudio();
