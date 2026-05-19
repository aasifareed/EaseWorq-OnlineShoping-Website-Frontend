import { Component, OnInit } from '@angular/core';
import { UntypedFormGroup, UntypedFormBuilder, Validators } from '@angular/forms';
import { Observable } from 'rxjs';
import { switchMap } from 'rxjs/operators';
import { environment } from '../../../environments/environment';
import { Product } from "../../shared/classes/product";
import { ProductService } from "../../shared/services/product.service";
import { OrderService } from "../../shared/services/order.service";
import { CreatePayFastCheckoutRequest, PayFastPaymentService } from './pay-fast-payment.service';
import { ToastrService } from 'ngx-toastr';
import { TranslateService } from '@ngx-translate/core';
import {
  OnlineShopOrderService,
  OnlineShopPaymentMethod,
  CreateOnlineShopSaleOrderResponse
} from '../../shared/services/online-shop-order.service';

@Component({
  selector: 'app-checkout',
  templateUrl: './checkout.component.html',
  styleUrls: ['./checkout.component.scss']
})
export class CheckoutComponent implements OnInit {

  public checkoutForm: UntypedFormGroup;
  public products: Product[] = [];
  public payment: string = 'PayFast';
  public amount: any;
  public loading = false;
  /** shipping | pickup — maps to backend OnlineShopShippingMethodEnum */
  public shippingMethod: 'shipping' | 'pickup' = 'shipping';

  constructor(
    private fb: UntypedFormBuilder,
    public productService: ProductService,
    private orderService: OrderService,
    private onlineShopOrder: OnlineShopOrderService,
    private payFast: PayFastPaymentService,
    private toastr: ToastrService,
    private translate: TranslateService,
  ) {
    this.checkoutForm = this.fb.group({
      customerName: ['', [Validators.required, Validators.pattern('[a-zA-Z][a-zA-Z ]+[a-zA-Z]$')]],
      customerMobileNo: ['', [Validators.required, Validators.pattern('[0-9]+')]],
      customerEmail: ['', [Validators.required, Validators.email]],
      description: [''],
      address: ['', [Validators.required, Validators.maxLength(50)]],
      town: ['', Validators.required],
      state: ['', Validators.required],
      postalcode: ['', Validators.required]
    });
  }

  ngOnInit(): void {
    this.productService.cartItems.subscribe(response => this.products = response);
    this.getTotal.subscribe(amount => this.amount = amount);
  }

  public get getTotal(): Observable<number> {
    return this.productService.cartTotalAmount();
  }

  /** Create DB order, then start PayFast hosted checkout with real order id/amount. */
  placeOrderPayFast(): void {
    if (this.checkoutForm.invalid) {
      this.checkoutForm.markAllAsTouched();
      return;
    }
    if (!this.products?.length) {
      this.toastr.warning('Your cart is empty.');
      return;
    }

    this.loading = true;
    const formValue = {
      ...this.checkoutForm.value,
      shippingMethod: this.shippingMethod
    };

    const orderRequest = this.onlineShopOrder.buildCreateOrderRequest(
      formValue,
      this.products,
      OnlineShopPaymentMethod.GoPayFast
    );

    this.onlineShopOrder.createOrder(orderRequest).pipe(
      switchMap((created: CreateOnlineShopSaleOrderResponse) => {
        if (!created?.onlineShopSaleOrderId) {
          throw new Error(created?.message || 'Order could not be created.');
        }
        this.onlineShopOrder.rememberPendingOrder(created);

        const payfastPayload: CreatePayFastCheckoutRequest = {
          orderId: created.onlineShopSaleOrderId,
          basketId: created.transactionReference
            || created.onlineOrderNumber
            || created.onlineShopSaleOrderId.replace(/-/g, ''),
          amount: created.totalAmount,
          customerName: formValue.customerName,
          customerEmail: formValue.customerEmail,
          customerMobileNo: formValue.customerMobileNo,
          description: created.onlineOrderNumber
            ? `Order ${created.onlineOrderNumber}`
            : (formValue.description || 'Online shop order')
        };

        return this.payFast.createCheckout(payfastPayload);
      })
    ).subscribe({
      next: (res) => {
        this.loading = false;
        this.payFast.redirectToPayFast(res);
      },
      error: (err) => {
        this.loading = false;
        const msg =
          err?.error?.error?.message ||
          err?.error?.message ||
          err?.message ||
          'Could not complete checkout. Please try again.';
        this.toastr.error(msg, this.translate.instant('toaster_Heading_Error'), { progressBar: true });
      }
    });
  }

  stripeCheckout() {
    var handler = (<any>window).StripeCheckout.configure({
      key: environment.stripe_token,
      locale: 'auto',
      token: (token: any) => {
        this.orderService.createOrder(this.products, this.checkoutForm.value, token.id, this.amount);
      }
    });
    handler.open({
      name: 'Multikart',
      description: 'Online Fashion Store',
      amount: this.amount * 100
    });
  }
}
