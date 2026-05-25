import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

export type ShopTheme = 'light' | 'dark';

@Injectable({
  providedIn: 'root'
})
export class ThemeService {
  private readonly storageKey = 'shop_theme';
  private readonly themeSubject = new BehaviorSubject<ShopTheme>('dark');

  readonly theme$ = this.themeSubject.asObservable();

  init(): void {
    const theme = this.readStoredTheme();
    this.applyTheme(theme);
    this.themeSubject.next(theme);
  }

  isDark(): boolean {
    return this.themeSubject.value === 'dark';
  }

  setTheme(theme: ShopTheme): void {
    if (theme === this.themeSubject.value) {
      return;
    }
    this.applyTheme(theme);
    this.themeSubject.next(theme);
    try {
      localStorage.setItem(this.storageKey, theme);
    } catch {
      // Ignore storage errors (private browsing, quota, etc.)
    }
  }

  toggle(): void {
    this.setTheme(this.isDark() ? 'light' : 'dark');
  }

  private readStoredTheme(): ShopTheme {
    try {
      const stored = localStorage.getItem(this.storageKey);
      return stored === 'light' ? 'light' : 'dark';
    } catch {
      return 'dark';
    }
  }

  private applyTheme(theme: ShopTheme): void {
    document.body.classList.toggle('dark', theme === 'dark');
  }
}
