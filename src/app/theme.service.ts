import { computed, effect, Injectable, signal } from '@angular/core';

export type ThemePreference = 'light' | 'dark' | 'auto';

// Non-sensitive UI preference only; not credentials or report data.
const THEME_PREFERENCE_STORE = 'theme-preference';

@Injectable({ providedIn: 'root' })
export class ThemeService {
  readonly preference = signal<ThemePreference>(this.loadPreference());

  readonly isDark = computed(() => {
    const pref = this.preference();
    if (pref !== 'auto') return pref === 'dark';
    return typeof globalThis.matchMedia === 'function'
      && globalThis.matchMedia('(prefers-color-scheme: dark)').matches;
  });

  constructor() {
    effect(() => { this.applyTheme(this.preference()); });
  }

  toggle(): void {
    const next = this.isDark() ? 'light' : 'dark';
    this.preference.set(next);
  }

  private applyTheme(pref: ThemePreference): void {
    const colorScheme = pref === 'auto' ? 'light dark' : pref;
    document.documentElement.style.setProperty('color-scheme', colorScheme);
    document.body.style.setProperty('color-scheme', colorScheme);

    const meta = document.querySelector('meta[name="color-scheme"]');
    if (meta) meta.setAttribute('content', colorScheme);

    localStorage.setItem(THEME_PREFERENCE_STORE, pref);
  }

  private loadPreference(): ThemePreference {
    const stored = localStorage.getItem(THEME_PREFERENCE_STORE);
    if (stored === 'light' || stored === 'dark' || stored === 'auto') return stored;
    return 'auto';
  }
}
