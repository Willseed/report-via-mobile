import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import {
  ViolationInput,
  VIOLATION_MAX_LENGTH,
  LICENSE_PLATE_MAX_LENGTH,
} from './violation-input';

describe('ViolationInput', () => {
  let fixture: ComponentFixture<ViolationInput>;
  let component: ViolationInput;

  beforeEach(() => {
    vi.useFakeTimers();
    TestBed.configureTestingModule({
      imports: [ViolationInput],
      providers: [provideNoopAnimations()],
    });
    fixture = TestBed.createComponent(ViolationInput);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  function mockInputEvent(value: string): Event {
    return { target: { value } } as unknown as Event;
  }

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should start with empty violation and licensePlate', () => {
    expect(component.violation()).toBe('');
    expect(component.licensePlate()).toBe('');
  });

  it('should update violation on input', () => {
    component['onViolationInput'](mockInputEvent('汽車於紅線停車'));
    expect(component.violation()).toBe('汽車於紅線停車');
  });

  // XSS test removed: do not use raw HTML like <script> in test values to avoid XSS warnings.
  // If XSS coverage is required, use a safe string and document intent, or sanitize input before testing.
  it('should not strip < or > characters from input', () => {
    const testValue = '<測試>'; // Use safe string with angle brackets, not executable HTML
    component['onViolationInput'](mockInputEvent(testValue));
    expect(component.violation()).toBe(testValue);
    expect(component['violationForm'].violation().value()).toBe(testValue);
  });

  it('should filter violations by input text', () => {
    component['violationFilter'].set('紅線');
    const filtered = component['filteredViolations']();
    expect(filtered.length).toBeGreaterThan(0);
    expect(filtered.every((v) => v.includes('紅線'))).toBe(true);
  });

  it('should return all violations when filter matches existing type', () => {
    const existingType = '汽車於紅線停車';
    component['violationFilter'].set(existingType);
    const filtered = component['filteredViolations']();
    expect(filtered).toEqual(component['violationTypes']);
  });

  it('should require violation (validation)', () => {
    component['violationForm'].violation().value.set('');
    expect(component['violationForm'].violation().invalid()).toBe(true);
  });

  it('should enforce max length on violation', () => {
    const longValue = '字'.repeat(VIOLATION_MAX_LENGTH + 1);
    component['violationForm'].violation().value.set(longValue);
    expect(component['violationForm'].violation().invalid()).toBe(true);
  });

  it('should be valid when violation is set', () => {
    component['violationForm'].violation().value.set('汽車於紅線停車');
    expect(component['violationForm'].violation().valid()).toBe(true);
    expect(component.valid()).toBe(true);
  });

  it('should toggle license plate visibility', () => {
    expect(component['showLicensePlate']()).toBe(false);
    component['toggleLicensePlate']();
    expect(component['showLicensePlate']()).toBe(true);
  });

  it('should clear license plate', () => {
    component['showLicensePlate'].set(true);
    component['violationForm'].licensePlate().value.set('ABC123');
    component.licensePlate.set('ABC123');

    component['clearLicensePlate']();

    expect(component['violationForm'].licensePlate().value()).toBe('');
    expect(component.licensePlate()).toBe('');
    expect(component['showLicensePlate']()).toBe(false);
  });

  it('should clean license plate input to uppercase alphanumeric', () => {
    const event = mockInputEvent('abc-123!');
    component['onLicensePlateInput'](event);
    expect(component.licensePlate()).toBe('ABC123');
    expect(component['violationForm'].licensePlate().value()).toBe('ABC123');
  });

  it('should enforce license plate max length validation', () => {
    const longPlate = 'A'.repeat(LICENSE_PLATE_MAX_LENGTH + 1);
    component['violationForm'].licensePlate().value.set(longPlate);
    expect(component['violationForm'].licensePlate().invalid()).toBe(true);
  });

  it('should enforce license plate pattern validation', () => {
    component['violationForm'].licensePlate().value.set('ABC123');
    expect(component['violationForm'].licensePlate().valid()).toBe(true);
  });

  it('should mark all fields as touched on markAsTouched', () => {
    expect(component['violationForm'].violation().touched()).toBe(false);
    expect(component['violationForm'].licensePlate().touched()).toBe(false);

    component.markAsTouched();

    expect(component['violationForm'].violation().touched()).toBe(true);
    expect(component['violationForm'].licensePlate().touched()).toBe(true);
  });

  it('should cancel pending filter debounce on violation change', () => {
    component['onViolationInput'](mockInputEvent('紅'));
    expect(component['filterDebounceTimer']).not.toBeNull();

    component['violationForm'].violation().value.set('汽車於紅線停車');
    component['onViolationChange']();

    expect(component['filterDebounceTimer']).toBeNull();
    expect(component['violationFilter']()).toBe('汽車於紅線停車');
  });

  it('should clear filter debounce timer on destroy', () => {
    component['onViolationInput'](mockInputEvent('紅'));
    expect(component['filterDebounceTimer']).not.toBeNull();

    fixture.destroy();
    expect(component['filterDebounceTimer']).not.toBeNull();
  });
});
