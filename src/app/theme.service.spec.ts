import { TestBed } from '@angular/core/testing';
import { ThemeService } from './theme.service';

describe('ThemeService', () => {
  let service: ThemeService;

  beforeEach(() => {
    localStorage.clear();
    document.documentElement.style.removeProperty('color-scheme');
    document.body.style.removeProperty('color-scheme');
  });

  function createService(): ThemeService {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({});
    return TestBed.inject(ThemeService);
  }

  it('should default to auto when no stored preference', () => {
    service = createService();
    expect(service.preference()).toBe('auto');
  });

  it('should load stored preference from localStorage', () => {
    localStorage.setItem('theme-preference', 'dark');
    service = createService();
    expect(service.preference()).toBe('dark');
  });

  it('should ignore invalid stored values', () => {
    localStorage.setItem('theme-preference', 'invalid');
    service = createService();
    expect(service.preference()).toBe('auto');
  });

  it('should toggle from light to dark', () => {
    service = createService();
    service.preference.set('light');
    service.toggle();
    expect(service.preference()).toBe('dark');
  });

  it('should toggle from dark to light', () => {
    service = createService();
    service.preference.set('dark');
    service.toggle();
    expect(service.preference()).toBe('light');
  });

  it('should persist preference to localStorage on change', () => {
    service = createService();
    service.preference.set('dark');
    TestBed.flushEffects();
    expect(localStorage.getItem('theme-preference')).toBe('dark');
  });

  it('should set color-scheme on documentElement', () => {
    service = createService();
    service.preference.set('light');
    TestBed.flushEffects();
    expect(document.documentElement.style.getPropertyValue('color-scheme')).toBe('light');
  });

  it('should set color-scheme to "light dark" for auto', () => {
    service = createService();
    service.preference.set('auto');
    TestBed.flushEffects();
    expect(document.documentElement.style.getPropertyValue('color-scheme')).toBe('light dark');
  });

  it('isDark should return true when preference is dark', () => {
    service = createService();
    service.preference.set('dark');
    expect(service.isDark()).toBe(true);
  });

  it('isDark should return false when preference is light', () => {
    service = createService();
    service.preference.set('light');
    expect(service.isDark()).toBe(false);
  });
});
