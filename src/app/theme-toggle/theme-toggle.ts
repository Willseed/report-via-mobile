import { Component, computed, inject } from '@angular/core';
import { ThemeService } from '../theme.service';
import { ZH_TW } from '../i18n';

@Component({
  selector: 'app-theme-toggle',
  template: `
    <button
      type="button"
      class="theme-toggle-button"
      (click)="theme.toggle()"
      [attr.aria-label]="ariaLabel()"
      [attr.title]="ariaLabel()"
    >
      <span class="material-icons theme-toggle-icon" aria-hidden="true">{{ icon() }}</span>
    </button>
  `,
  styles: `
    :host {
      display: contents;
    }

    .theme-toggle-button {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 40px;
      height: 40px;
      padding: 0;
      border: 0;
      border-radius: 999px;
      background: transparent;
      color: inherit;
      cursor: pointer;
      transition:
        background-color 150ms ease,
        color 150ms ease;
    }

    .theme-toggle-button:hover {
      background: color-mix(in srgb, currentColor 8%, transparent);
    }

    .theme-toggle-button:focus-visible {
      outline: 2px solid currentColor;
      outline-offset: 2px;
    }

    .theme-toggle-icon {
      font-size: 24px;
      line-height: 1;
    }
  `,
})
export class ThemeToggle {
  protected readonly theme = inject(ThemeService);
  private readonly i18n = ZH_TW.theme;

  protected readonly icon = computed(() =>
    this.theme.isDark() ? 'light_mode' : 'dark_mode'
  );

  protected readonly ariaLabel = computed(() =>
    this.theme.isDark() ? this.i18n.switchToLight : this.i18n.switchToDark
  );
}
