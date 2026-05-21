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

export function trimMaxLength(max: number): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const value = (control.value ?? '').toString().trim();
    if (!value) {
      return null;
    }
    return value.length <= max ? null : { maxlength: { requiredLength: max, actualLength: value.length } };
  };
}
