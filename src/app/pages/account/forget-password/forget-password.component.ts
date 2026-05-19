import { Component, OnInit } from '@angular/core';
import { UntypedFormBuilder, UntypedFormGroup, Validators } from '@angular/forms';
import { AuthService } from '../../../shared/services/auth.service';
import { ToastrService } from 'ngx-toastr';

@Component({
  selector: 'app-forget-password',
  templateUrl: './forget-password.component.html',
  styleUrls: ['./forget-password.component.scss']
})
export class ForgetPasswordComponent implements OnInit {

  form: UntypedFormGroup;
  loading = false;

  constructor(
    private fb: UntypedFormBuilder,
    private auth: AuthService,
    private toastr: ToastrService
  ) {
    this.form = this.fb.group({
      email: ['', [Validators.required, Validators.email]]
    });
  }

  ngOnInit(): void {
    this.auth.seedShopContextFromEnvironment();
  }

  submit(): void {
    if (this.form.invalid || this.loading) {
      this.form.markAllAsTouched();
      return;
    }

    this.loading = true;
    this.auth.resetPasswordRequest(this.form.value.email).subscribe({
      next: (msg) => {
        this.loading = false;
        this.toastr.success(msg);
      },
      error: () => {
        this.loading = false;
      }
    });
  }

}
