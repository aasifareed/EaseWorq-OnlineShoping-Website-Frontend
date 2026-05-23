import { Component, OnInit } from '@angular/core';
import { AbstractControl, UntypedFormBuilder, UntypedFormGroup, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../../shared/services/auth.service';
import { ToastrService } from 'ngx-toastr';

@Component({
  selector: 'app-register',
  templateUrl: './register.component.html',
  styleUrls: ['./register.component.scss']
})
export class RegisterComponent implements OnInit {

  registerForm: UntypedFormGroup;
  loading = false;

  constructor(
    private fb: UntypedFormBuilder,
    private auth: AuthService,
    private router: Router,
    private toastr: ToastrService
  ) {
    this.registerForm = this.fb.group({
      firstName: ['', Validators.required],
      lastName: ['', Validators.required],
      email: ['', [Validators.required, Validators.email]],
      phone: [''],
      password: ['', [Validators.required, Validators.minLength(6)]],
      confirmPassword: ['', Validators.required]
    }, { validators: this.passwordMatchValidator });
  }

  ngOnInit(): void {
    this.auth.seedShopContextFromEnvironment();
  }

  passwordMatchValidator(group: AbstractControl): { mismatch: boolean } | null {
    const pass = group.get('password')?.value;
    const confirm = group.get('confirmPassword')?.value;
    return pass === confirm ? null : { mismatch: true };
  }

  submit(): void {
    if (this.registerForm.invalid || this.loading) {
      this.registerForm.markAllAsTouched();
      return;
    }

    const v = this.registerForm.value;
    const email = String(v.email).trim();
    this.loading = true;

    this.auth.signup({
      userName: email,
      name: v.firstName.trim(),
      surname: v.lastName.trim(),
      emailAddress: email,
      phoneNumber: v.phone?.trim() || '',
      password: v.password,
      storeId: this.auth.storeId,
      tenantId: this.auth.tenantId
    }).subscribe({
      next: (msg) => {
        this.loading = false;
        this.auth.saveCustomerProfile({
          customerName: `${v.firstName.trim()} ${v.lastName.trim()}`.trim(),
          customerEmail: email,
          customerMobileNo: v.phone?.trim() || undefined
        });
        this.toastr.success(msg);
        this.router.navigate(['/pages/login']);
      },
      error: () => {
        this.loading = false;
      }
    });
  }

}
