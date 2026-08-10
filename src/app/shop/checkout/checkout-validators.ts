import { AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';

/** Required after trimming whitespace (trailing spaces allowed while typing). */
export function trimRequired(): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const value = (control.value ?? '').toString().trim();
    return value.length > 0 ? null : { required: true };
  };
}

/** Letters and spaces only; validates trimmed value. */
export function trimPersonName(): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const value = (control.value ?? '').toString().trim();
    if (!value) {
      return null;
    }
    return /^[a-zA-Z]+(?:\s+[a-zA-Z]+)*$/.test(value) ? null : { personName: true };
  };
}

/** Digits only; validates trimmed value. */
export function trimDigitsOnly(): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const value = (control.value ?? '').toString().trim();
    if (!value) {
      return null;
    }
    return /^[0-9]+$/.test(value) ? null : { digitsOnly: true };
  };
}

/**
 * International phone: optional leading +, digits required.
 * Allows spaces, hyphens, and parentheses while typing (stripped for validation).
 * Examples: +923017438739, 03017438739, 923017438739
 */
export function trimPhoneNumber(): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const raw = (control.value ?? '').toString().trim();
    if (!raw) {
      return null;
    }
    const normalized = raw.replace(/[\s\-().]/g, '');
    // Optional +, then 7–15 digits (E.164 digit count range)
    if (!/^\+?[0-9]{7,15}$/.test(normalized)) {
      return { phone: true };
    }
    return null;
  };
}

export function trimMaxLength(max: number): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const value = (control.value ?? '').toString().trim();
    if (!value) {
      return null;
    }
    return value.length <= max ? null : { maxlength: { requiredLength: max, actualLength: value.length } };
  };
}

/** Value must match a confirmed autocomplete selection (not free-typed text). */
export function mustMatchSelectedValue(getConfirmed: () => string): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const value = (control.value ?? '').toString().trim();
    if (!value) {
      return null;
    }
    const confirmed = (getConfirmed() ?? '').trim();
    if (!confirmed || value.toLowerCase() !== confirmed.toLowerCase()) {
      return { mustSelectSuggestion: true };
    }
    return null;
  };
}
