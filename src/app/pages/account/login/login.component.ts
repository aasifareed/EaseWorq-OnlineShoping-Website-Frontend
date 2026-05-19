import { Component, OnInit } from '@angular/core';
import { UntypedFormBuilder, UntypedFormGroup, Validators } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { AuthService } from '../../../shared/services/auth.service';
import { ToastrService } from 'ngx-toastr';

@Component({
  selector: 'app-login',
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.scss']
})
export class LoginComponent implements OnInit {

  loginForm: UntypedFormGroup;
  loading = false;
  private returnUrl: string | null = null;

  constructor(
    private fb: UntypedFormBuilder,
    private auth: AuthService,
    private route: ActivatedRoute,
    private toastr: ToastrService
  ) {
    this.loginForm = this.fb.group({
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required, Validators.minLength(6)]],
      remember: [false]
    });
  }

  ngOnInit(): void {
    this.auth.seedShopContextFromEnvironment();
    this.returnUrl = this.route.snapshot.queryParamMap.get('returnUrl');
  }

  submit(): void {
    if (this.loginForm.invalid || this.loading) {
      this.loginForm.markAllAsTouched();
      return;
    }

    this.loading = true;
    const { email, password, remember } = this.loginForm.value;

    this.auth.login(email, password, !!remember).subscribe({
      next: () => {
        this.loading = false;
        this.toastr.success('Welcome! You have logged in successfully.');
        this.auth.navigateAfterLogin(this.returnUrl);
      },
      error: (err) => {
        this.loading = false;
        const msg = err?.error?.message || err?.message;
        if (msg) {
          this.toastr.error(msg);
        }
      }
    });
  }

}
