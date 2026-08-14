import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { PayFastPaymentService } from '../pay-fast-payment.service';

@Component({
  selector: 'app-payfast-return',
  templateUrl: './payfast-return.component.html',
  styleUrls: ['./payfast-return.component.scss'],
})
export class PayFastReturnComponent implements OnInit {
  message = 'Confirming your payment…';

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private payFast: PayFastPaymentService,
  ) {}

  ngOnInit(): void {
    const fields: Record<string, string> = {};
    this.route.snapshot.queryParamMap.keys.forEach((key) => {
      const value = this.route.snapshot.queryParamMap.get(key);
      if (value != null && value !== '') {
        fields[key] = value;
      }
    });

    this.payFast.completeMobileReturn(fields).subscribe({
      next: (res) => {
        const orderId = res?.orderId;
        if (res?.success && orderId) {
          void this.router.navigate(['/shop/checkout/success', orderId], { replaceUrl: true });
          return;
        }
        if (orderId) {
          void this.router.navigate(['/shop/checkout/failure', orderId], { replaceUrl: true });
          return;
        }
        void this.router.navigate(['/shop/checkout/failure'], { replaceUrl: true });
      },
      error: () => {
        this.message = 'Could not confirm payment. Taking you to the order page…';
        void this.router.navigate(['/shop/checkout/failure'], { replaceUrl: true });
      },
    });
  }
}
