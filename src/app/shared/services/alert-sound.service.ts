import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root',
})
export class AlertSoundService {
  private context?: AudioContext;
  private lastPlayedAt = 0;

  constructor() {
    if (typeof document === 'undefined') {
      return;
    }
    const unlock = () => this.unlock();
    document.addEventListener('click', unlock, { capture: true, once: true });
    document.addEventListener('keydown', unlock, { capture: true, once: true });
    document.addEventListener('touchstart', unlock, { capture: true, once: true });
  }

  play(): void {
    const now = Date.now();
    if (now - this.lastPlayedAt < 450) {
      return;
    }
    this.lastPlayedAt = now;
    void this.playChime();
  }

  private unlock(): void {
    const ctx = this.getContext();
    if (ctx?.state === 'suspended') {
      void ctx.resume();
    }
  }

  private getContext(): AudioContext | null {
    if (typeof window === 'undefined') {
      return null;
    }
    const AudioCtx = window.AudioContext || (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) {
      return null;
    }
    if (!this.context) {
      this.context = new AudioCtx();
    }
    return this.context;
  }

  private async playChime(): Promise<void> {
    const ctx = this.getContext();
    if (!ctx) {
      return;
    }
    if (ctx.state === 'suspended') {
      try {
        await ctx.resume();
      } catch {
        return;
      }
    }

    const start = ctx.currentTime;
    this.tone(ctx, 880, start, 0.12);
    this.tone(ctx, 1175, start + 0.11, 0.16);
  }

  private tone(ctx: AudioContext, frequency: number, start: number, duration: number): void {
    const oscillator = ctx.createOscillator();
    const gain = ctx.createGain();
    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(frequency, start);
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(0.16, start + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    oscillator.connect(gain);
    gain.connect(ctx.destination);
    oscillator.start(start);
    oscillator.stop(start + duration + 0.02);
  }
}
