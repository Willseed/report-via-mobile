import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { MatIconButton } from '@angular/material/button';
import { MatIcon } from '@angular/material/icon';
import { MatTooltip } from '@angular/material/tooltip';
import { ThemeService } from '../theme.service';
import { ZH_TW } from '../i18n';

@Component({
  selector: 'app-theme-toggle',
  imports: [MatIconButton, MatIcon, MatTooltip],
  template: `
    <button
      mat-icon-button
      (click)="theme.toggle()"
      [attr.aria-label]="ariaLabel()"
      [matTooltip]="ariaLabel()"
    >
      <mat-icon>{{ icon() }}</mat-icon>
    </button>
  `,
  styles: `
    :host {
      display: contents;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
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
