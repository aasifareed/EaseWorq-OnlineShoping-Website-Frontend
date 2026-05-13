import { Component, OnInit } from '@angular/core';
import { UntypedFormGroup, UntypedFormBuilder, Validators } from '@angular/forms';
import { Observable } from 'rxjs';
// import { IPayPalConfig, ICreateOrderRequest } from 'ngx-paypal';
import { environment } from '../../../environments/environment';
import { Product } from "../../shared/classes/product";
import { ProductService } from "../../shared/services/product.service";
import { OrderService } from "../../shared/services/order.service";
import { CreatePayFastCheckoutRequest, PayFastPaymentService } from './pay-fast-payment.service';
import { ToastrService } from 'ngx-toastr';
import { TranslateService } from '@ngx-translate/core';

@Component({
  selector: 'app-checkout',
  templateUrl: './checkout.component.html',
  styleUrls: ['./checkout.component.scss']
})
export class CheckoutComponent implements OnInit {

  public checkoutForm:  UntypedFormGroup;
  public products: Product[] = [];
  // public payPalConfig ? : IPayPalConfig;
  public payment: string = 'PayFast';
  // public payment: string = 'Stripe';
  public amount:  any;
  loading: boolean= false;

  constructor(private fb: UntypedFormBuilder,
    public productService: ProductService,
    private orderService: OrderService,
        private payFast: PayFastPaymentService,
  private toastr: ToastrService,
    private translate: TranslateService,
  ) { 
    this.checkoutForm = this.fb.group({
      // firstname: ['', [Validators.required, Validators.pattern('[a-zA-Z][a-zA-Z ]+[a-zA-Z]$')]],
      customerName: ['', [Validators.required, Validators.pattern('[a-zA-Z][a-zA-Z ]+[a-zA-Z]$')]],
      customerMobileNo: ['', [Validators.required, Validators.pattern('[0-9]+')]],
      customerEmail: ['', [Validators.required, Validators.email]],
      description: [''],
      address: ['', [Validators.required, Validators.maxLength(50)]],
      // country: ['', Validators.required],
      town: ['', Validators.required],
      state: ['', Validators.required],
      postalcode: ['', Validators.required]
    })
  }

  ngOnInit(): void {
    this.productService.cartItems.subscribe(response => this.products = response);
    this.getTotal.subscribe(amount => this.amount = amount);
    this.initConfig();
  }

  public get getTotal(): Observable<number> {
    return this.productService.cartTotalAmount();
  }
GoPayFastCHeckout(){
 this.loading = true;
    let payload: CreatePayFastCheckoutRequest ;
    payload =  this.checkoutForm.value as CreatePayFastCheckoutRequest; 
  payload  = {
    ...payload,
      amount: Number(this.amount),
  
      // description: this.description || 'PayFast test',
      basketId: this.products.map(p => p.id).join(',')
    };
    const oid = this.products.map(p => p.id).join(',');
    if (oid) {
      payload.orderId = oid;
    }

    this.payFast.createCheckout(payload).subscribe({
      next: (res) => {
        this.loading = false;
        this.payFast.redirectToPayFast(res);
      },
      error: (err) => {
        this.loading = false;
        const msg =
          err?.error?.error?.message ||
          err?.error?.message ||
          'Could not start PayFast checkout. Check API URL, SecuredKey, and backend logs.';
        this.toastr.error(msg, this.translate.instant('toaster_Heading_Error'), { progressBar: true });
      }
    });
}
  // Stripe Payment Gateway
  stripeCheckout() {
    var handler = (<any>window).StripeCheckout.configure({
      key: environment.stripe_token, // publishble key
      locale: 'auto',
      token: (token: any) => {
        // You can access the token ID with `token.id`.
        // Get the token ID to your server-side code for use.
        this.orderService.createOrder(this.products, this.checkoutForm.value, token.id, this.amount);
      }
    });
    handler.open({
      name: 'Multikart',
      description: 'Online Fashion Store',
      amount: this.amount * 100
    }) 
  }

  // Paypal Payment Gateway
  private initConfig(): void {
    // this.payPalConfig = {
    //     currency: this.productService.Currency.currency,
    //     clientId: environment.paypal_token,
    //     createOrderOnClient: (data) => < ICreateOrderRequest > {
    //       intent: 'CAPTURE',
    //       purchase_units: [{
    //           amount: {
    //             currency_code: this.productService.Currency.currency,
    //             value: this.amount,
    //             breakdown: {
    //                 item_total: {
    //                     currency_code: this.productService.Currency.currency,
    //                     value: this.amount
    //                 }
    //             }
    //           }
    //       }]
    //   },
    //     advanced: {
    //         commit: 'true'
    //     },
    //     style: {
    //         label: 'paypal',
    //         size:  'small', // small | medium | large | responsive
    //         shape: 'rect', // pill | rect
    //     },
    //     onApprove: (data, actions) => {
    //         this.orderService.createOrder(this.products, this.checkoutForm.value, data.orderID, this.getTotal);
    //         console.log('onApprove - transaction was approved, but not authorized', data, actions);
    //         actions.order.get().then(details => {
    //             console.log('onApprove - you can get full order details inside onApprove: ', details);
    //         });
    //     },
    //     onClientAuthorization: (data) => {
    //         console.log('onClientAuthorization - you should probably inform your server about completed transaction at this point', data);
    //     },
    //     onCancel: (data, actions) => {
    //         console.log('OnCancel', data, actions);
    //     },
    //     onError: err => {
    //         console.log('OnError', err);
    //     },
    //     onClick: (data, actions) => {
    //         console.log('onClick', data, actions);
    //     }
    // };
  }

}
