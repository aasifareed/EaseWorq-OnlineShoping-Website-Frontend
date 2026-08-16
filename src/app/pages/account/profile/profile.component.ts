import { Component, OnInit } from '@angular/core';
import { UntypedFormBuilder, UntypedFormGroup, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { ToastrService } from 'ngx-toastr';
import { AuthService, ShopCustomerProfile } from '../../../shared/services/auth.service';
import { trimMaxLength, trimRequired } from '../../../shop/checkout/checkout-validators';

@Component({
  selector: 'app-profile',
  templateUrl: './profile.component.html',
  styleUrls: ['./profile.component.scss']
})
export class ProfileComponent implements OnInit {

  form: UntypedFormGroup;
  loading = false;
  saving = false;

  constructor(
    private fb: UntypedFormBuilder,
    private auth: AuthService,
    private toastr: ToastrService,
    private router: Router
  ) {
    this.form = this.fb.group({
      firstName: ['', Validators.required],
      lastName: ['', Validators.required],
      email: [{ value: '', disabled: true }],
      phone: [''],
      address: ['', [trimRequired(), trimMaxLength(100)]],
      town: ['', trimRequired()],
      state: ['', trimRequired()],
      postalcode: ['', trimRequired()]
    });
  }

  ngOnInit(): void {
    this.auth.seedShopContextFromEnvironment();
    if (!this.auth.isLoggedIn()) {
      void this.router.navigate(['/pages/login'], { queryParams: { returnUrl: '/pages/profile' } });
      return;
    }

    this.patchFromProfile(this.auth.getCustomerProfile());
    this.loading = true;
    this.auth.refreshCustomerProfileForCheckout().subscribe({
      next: (profile) => {
        this.patchFromProfile(profile);
        this.loading = false;
      },
      error: () => {
        this.loading = false;
      }
    });
  }

  touchedInvalid(name: string): boolean {
    const control = this.form.get(name);
    return !!control && control.touched && control.invalid;
  }

  hasError(name: string, error: string): boolean {
    return !!this.form.get(name)?.hasError(error);
  }

  submit(): void {
    if (this.form.invalid || this.saving) {
      this.form.markAllAsTouched();
      return;
    }

    const v = this.form.getRawValue();
    this.saving = true;
    this.auth.updateCustomerProfile({
      firstName: v.firstName,
      lastName: v.lastName,
      phoneNumber: v.phone,
      address: v.address,
      townCity: v.town,
      stateCounty: v.state,
      postalCode: v.postalcode
    }).subscribe({
      next: () => {
        this.saving = false;
        this.toastr.success('Your profile has been updated.');
      },
      error: () => {
        this.saving = false;
      }
    });
  }

  private patchFromProfile(profile: ShopCustomerProfile | null): void {
    const email = profile?.customerEmail || this.auth.getCustomerEmail() || '';
    const { firstName, lastName } = this.splitName(profile?.customerName);
    this.form.patchValue({
      firstName,
      lastName,
      email,
      phone: profile?.customerMobileNo || '',
      address: profile?.address || '',
      town: profile?.town || '',
      state: profile?.state || '',
      postalcode: profile?.postalcode || ''
    });
  }

  private splitName(fullName: string | undefined): { firstName: string; lastName: string } {
    const parts = String(fullName || '').trim().split(/\s+/).filter(Boolean);
    if (!parts.length) {
      return { firstName: '', lastName: '' };
    }
    if (parts.length === 1) {
      return { firstName: parts[0], lastName: '' };
    }
    return {
      firstName: parts[0],
      lastName: parts.slice(1).join(' ')
    };
  }
}
