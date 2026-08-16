import { Component, OnDestroy, OnInit } from '@angular/core';
import { AbstractControl, UntypedFormBuilder, UntypedFormGroup, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../../shared/services/auth.service';
import { ToastrService } from 'ngx-toastr';

type ResetStep = 'email' | 'otp' | 'password';

@Component({
  selector: 'app-forget-password',
  templateUrl: './forget-password.component.html',
  styleUrls: ['./forget-password.component.scss']
})
export class ForgetPasswordComponent implements OnInit, OnDestroy {

  step: ResetStep = 'email';
  emailForm: UntypedFormGroup;
  otpForm: UntypedFormGroup;
  passwordForm: UntypedFormGroup;
  loading = false;
  secondsLeft = 0;
  emailAddress = '';

  private timerHandle: ReturnType<typeof setInterval> | null = null;

  constructor(
    private fb: UntypedFormBuilder,
    private auth: AuthService,
    private toastr: ToastrService,
    private router: Router
  ) {
    this.emailForm = this.fb.group({
      email: ['', [Validators.required, Validators.email]]
    });
    this.otpForm = this.fb.group({
      otpCode: ['', [Validators.required, Validators.minLength(5), Validators.maxLength(5), Validators.pattern(/^\d{5}$/)]]
    });
    this.passwordForm = this.fb.group({
      password: ['', [Validators.required, Validators.minLength(6)]],
      confirmPassword: ['', Validators.required]
    }, { validators: this.passwordMatchValidator });
  }

  ngOnInit(): void {
    this.auth.seedShopContextFromEnvironment();
  }

  ngOnDestroy(): void {
    this.clearTimer();
  }

  get canResend(): boolean {
    return this.secondsLeft <= 0 && !this.loading;
  }

  touchedInvalid(form: UntypedFormGroup, name: string): boolean {
    const control = form.get(name);
    return !!control && control.touched && control.invalid;
  }

  hasError(form: UntypedFormGroup, name: string, error: string): boolean {
    return !!form.get(name)?.hasError(error);
  }

  showPasswordMismatch(): boolean {
    if (!this.passwordForm.errors?.['mismatch']) {
      return false;
    }
    const password = this.passwordForm.get('password');
    const confirm = this.passwordForm.get('confirmPassword');
    if (!password?.touched && !confirm?.touched) {
      return false;
    }
    return String(confirm?.value ?? '').length > 0;
  }

  submitEmail(): void {
    if (this.emailForm.invalid || this.loading) {
      this.emailForm.markAllAsTouched();
      return;
    }

    this.emailAddress = String(this.emailForm.value.email || '').trim();
    this.sendCode();
  }

  submitOtp(): void {
    if (this.otpForm.invalid || this.loading) {
      this.otpForm.markAllAsTouched();
      return;
    }

    this.loading = true;
    this.auth.checkPasswordResetOtp(this.emailAddress, this.otpForm.value.otpCode).subscribe({
      next: () => {
        this.loading = false;
        this.clearTimer();
        this.step = 'password';
      },
      error: () => {
        this.loading = false;
      }
    });
  }

  submitPassword(): void {
    if (this.passwordForm.invalid || this.loading) {
      this.passwordForm.markAllAsTouched();
      return;
    }

    this.loading = true;
    this.auth.changePasswordByOtp(this.emailAddress, this.passwordForm.value.password).subscribe({
      next: (msg) => {
        this.loading = false;
        this.toastr.success(msg);
        void this.router.navigate(['/pages/login']);
      },
      error: () => {
        this.loading = false;
      }
    });
  }

  resendCode(): void {
    if (!this.canResend) {
      return;
    }
    this.sendCode(true);
  }

  private sendCode(isResend = false): void {
    this.loading = true;
    this.auth.resetPasswordRequest(this.emailAddress).subscribe({
      next: (msg) => {
        this.loading = false;
        this.toastr.success(msg);
        this.otpForm.reset();
        this.step = 'otp';
        this.startTimer();
      },
      error: () => {
        this.loading = false;
        if (!isResend) {
          this.emailAddress = '';
        }
      }
    });
  }

  private startTimer(): void {
    this.clearTimer();
    this.secondsLeft = 180;
    this.timerHandle = setInterval(() => {
      this.secondsLeft -= 1;
      if (this.secondsLeft <= 0) {
        this.clearTimer();
        this.auth.expirePasswordResetOtp(this.emailAddress).subscribe();
        this.toastr.info('The code has expired. Request a new one.');
      }
    }, 1000);
  }

  private clearTimer(): void {
    if (this.timerHandle) {
      clearInterval(this.timerHandle);
      this.timerHandle = null;
    }
  }

  private passwordMatchValidator(group: AbstractControl): { mismatch: boolean } | null {
    const pass = group.get('password')?.value;
    const confirm = group.get('confirmPassword')?.value;
    return pass === confirm ? null : { mismatch: true };
  }
}
