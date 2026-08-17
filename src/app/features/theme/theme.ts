import { Injectable, PLATFORM_ID, computed, effect, inject, signal } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

export type ThemeChoice = 'system' | 'light' | 'dark';
export type Resolved = 'light' | 'dark';

const KEY = 'atsproof:theme';

// Starts light, follows an explicit choice, and remembers it. 'system' is
// available but is not the default: most people arrive expecting paper.
@Injectable({ providedIn: 'root' })
export class Theme {
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  readonly choice = signal<ThemeChoice>(this.restore());
  private readonly systemDark = signal(this.prefersDark());

  readonly resolved = computed<Resolved>(() => {
    const choice = this.choice();
    if (choice !== 'system') return choice;
    return this.systemDark() ? 'dark' : 'light';
  });

  constructor() {
    const query = this.mediaQuery();
    query?.addEventListener('change', (e) => this.systemDark.set(e.matches));

    effect(() => {
      const theme = this.resolved();
      const choice = this.choice();
      if (!this.isBrowser) return;

      document.documentElement.dataset['theme'] = theme;
      document.documentElement.style.colorScheme = theme;
      try {
        localStorage.setItem(KEY, choice);
      } catch {
        // Storage can be unavailable; the theme still applies for this visit.
      }
    });
  }

  toggle() {
    this.choice.set(this.resolved() === 'dark' ? 'light' : 'dark');
  }

  // matchMedia is missing in some test environments and older embedded views.
  private mediaQuery(): MediaQueryList | null {
    if (!this.isBrowser || typeof matchMedia !== 'function') return null;
    return matchMedia('(prefers-color-scheme: dark)');
  }

  private prefersDark(): boolean {
    return this.mediaQuery()?.matches ?? false;
  }

  private restore(): ThemeChoice {
    if (!this.isBrowser) return 'light';
    try {
      const stored = localStorage.getItem(KEY);
      if (stored === 'light' || stored === 'dark' || stored === 'system') return stored;
    } catch {
      // Storage blocked; fall through to the default.
    }
    return 'light';
  }
}
