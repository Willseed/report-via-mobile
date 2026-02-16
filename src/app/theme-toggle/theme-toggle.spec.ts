import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ThemeToggle } from './theme-toggle';
import { ThemeService } from '../theme.service';

describe('ThemeToggle', () => {
  let fixture: ComponentFixture<ThemeToggle>;
  let service: ThemeService;

  beforeEach(() => {
    localStorage.clear();

    TestBed.configureTestingModule({
      imports: [ThemeToggle],
    });

    service = TestBed.inject(ThemeService);
    fixture = TestBed.createComponent(ThemeToggle);
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('should show dark_mode icon when in light mode', () => {
    service.preference.set('light');
    fixture.detectChanges();
    const icon = fixture.nativeElement.querySelector('mat-icon');
    expect(icon.textContent.trim()).toBe('dark_mode');
  });

  it('should show light_mode icon when in dark mode', () => {
    service.preference.set('dark');
    fixture.detectChanges();
    const icon = fixture.nativeElement.querySelector('mat-icon');
    expect(icon.textContent.trim()).toBe('light_mode');
  });

  it('should toggle theme on click', () => {
    service.preference.set('light');
    fixture.detectChanges();
    const button = fixture.nativeElement.querySelector('button');
    button.click();
    expect(service.preference()).toBe('dark');
  });

  it('should have accessible aria-label', () => {
    service.preference.set('light');
    fixture.detectChanges();
    const button = fixture.nativeElement.querySelector('button');
    expect(button.getAttribute('aria-label')).toBe('切換為深色模式');
  });

  it('should update aria-label when toggled to dark', () => {
    service.preference.set('dark');
    fixture.detectChanges();
    const button = fixture.nativeElement.querySelector('button');
    expect(button.getAttribute('aria-label')).toBe('切換為淺色模式');
  });
});
