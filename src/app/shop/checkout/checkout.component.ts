import { Component, OnInit } from '@angular/core';
import { UntypedFormGroup, UntypedFormBuilder, Validators, AbstractControl, ValidationErrors } from '@angular/forms';
import { trimRequired, trimPersonName, trimDigitsOnly, trimMaxLength } from './checkout-validators';
import { Router } from '@angular/router';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { Product } from '../../shared/classes/product';
import { ProductService } from '../../shared/services/product.service';
import { OrderService } from '../../shared/services/order.service';
import { CreatePayFastCheckoutRequest, PayFastPaymentService } from './pay-fast-payment.service';
import { ToastrService } from 'ngx-toastr';
import { TranslateService } from '@ngx-translate/core';
import { AuthService } from '../../shared/services/auth.service';
import {
  OnlineShopOrderService,
  OnlineShopPaymentMethod,
  OnlineShopShippingMethod,
  ONLINE_SHOP_PAYMENT_METHOD_LABELS,
  ONLINE_SHOP_SHIPPING_METHOD_LABELS,
  CheckoutFormValues,
  CreateOnlineShopSaleOrderResponse,
  CheckoutAddressFormValues,
  OnlineShopSaleOrderAddress
} from '../../shared/services/online-shop-order.service';

@Component({
  selector: 'app-checkout',
  templateUrl: './checkout.component.html',
  styleUrls: ['./checkout.component.scss']
})
export class CheckoutComponent implements OnInit {

  public checkoutForm: UntypedFormGroup;
  public products: Product[] = [];
  public amount: any;
  public loading = false;

  public paymentMethod: OnlineShopPaymentMethod = OnlineShopPaymentMethod.GoPayFast;
  public shippingMethod: OnlineShopShippingMethod = OnlineShopShippingMethod.Shipping;

  readonly OnlineShopPaymentMethod = OnlineShopPaymentMethod;
  readonly OnlineShopShippingMethod = OnlineShopShippingMethod;
  readonly paymentMethodOptions = [
    OnlineShopPaymentMethod.CashOnDelivery,
    OnlineShopPaymentMethod.GoPayFast
  ];
  readonly shippingMethodOptions = [
    OnlineShopShippingMethod.Shipping,
    OnlineShopShippingMethod.LocalPickup
  ];
  readonly paymentMethodLabels = ONLINE_SHOP_PAYMENT_METHOD_LABELS;
  readonly shippingMethodLabels = ONLINE_SHOP_SHIPPING_METHOD_LABELS;

  constructor(
    private fb: UntypedFormBuilder,
    public productService: ProductService,
    private orderService: OrderService,
    private onlineShopOrder: OnlineShopOrderService,
    private auth: AuthService,
    private payFast: PayFastPaymentService,
    private router: Router,
    private toastr: ToastrService,
    private translate: TranslateService,
  ) {
    this.checkoutForm = this.fb.group({
      billing: this.createBillingAddressGroup(),
      shipping: this.createShippingAddressGroup(),
      shipToDifferentAddress: [false],
      description: ['']
    });
    this.setShippingValidators(false);
  }

  ngOnInit(): void {
    this.productService.cartItems.subscribe(response => this.products = response);
    this.productService.cartTotalAmount().subscribe(amount => this.amount = amount);

    this.checkoutForm.get('shipToDifferentAddress')?.valueChanges.subscribe((checked: boolean) => {
      this.setShippingValidators(!!checked);
      if (!checked) {
        this.shippingGroup.reset();
      }
    });

    this.prefillCheckoutCustomerDetails();
  }

  /** Do not use checkoutForm.valid — disabled nested groups break it; validate billing + shipping explicitly. */
  get canPlaceOrder(): boolean {
    if (this.loading || !this.products?.length) {
      return false;
    }
    if (this.billingGroup.invalid) {
      return false;
    }
    if (this.shipToDifferentAddress && this.shippingGroup.invalid) {
      return false;
    }
    return true;
  }

  public get getTotal(): Observable<number> {
    return this.productService.cartTotalAmount();
  }

  get billingGroup(): UntypedFormGroup {
    return this.checkoutForm.get('billing') as UntypedFormGroup;
  }

  get shippingGroup(): UntypedFormGroup {
    return this.checkoutForm.get('shipping') as UntypedFormGroup;
  }

  get shipToDifferentAddress(): boolean {
    return !!this.checkoutForm.get('shipToDifferentAddress')?.value;
  }

  placeOrder(): void {
    if (!this.canPlaceOrder) {
      this.checkoutForm.markAllAsTouched();
      return;
    }
    if (!this.products?.length) {
      this.toastr.warning('Your cart is empty.');
      return;
    }

    if (!this.auth.isLoggedIn() || !this.auth.getCustomerEmail()) {
      this.toastr.warning('Please sign in to place an order.');
      this.auth.navigateToLogin('/shop/checkout');
      return;
    }

    this.loading = true;
    const formValue = this.buildCheckoutPayload();
    const orderRequest = this.onlineShopOrder.buildCreateOrderRequest(
      formValue,
      this.products,
      this.paymentMethod
    );

    this.onlineShopOrder.createOrder(orderRequest).subscribe({
      next: (created: CreateOnlineShopSaleOrderResponse) => {
        if (!created?.onlineShopSaleOrderId) {
          this.loading = false;
          this.toastr.error(created?.message || 'Order could not be created.');
          return;
        }

        this.onlineShopOrder.rememberPendingOrder(created);

        if (this.paymentMethod === OnlineShopPaymentMethod.CashOnDelivery) {
          this.loading = false;
          this.persistCustomerProfileFromBilling(formValue.billing);
          this.clearCartAfterOrder();
          this.router.navigate(['/shop/checkout/success', created.onlineShopSaleOrderId]);
          return;
        }

        const billing = formValue.billing;
        const payfastPayload: CreatePayFastCheckoutRequest = {
          orderId: created.onlineShopSaleOrderId,
          basketId: created.transactionReference || created.onlineShopSaleOrderId,
          amount: created.totalAmount,
          customerName: billing.customerName,
          customerEmail: billing.customerEmail,
          customerMobileNo: billing.customerMobileNo,
          description: created.onlineOrderNumber
            ? `Order ${created.onlineOrderNumber}`
            : (formValue.description || 'Online shop order')
        };

        this.payFast.createCheckout(payfastPayload).subscribe({
          next: (res) => {
            this.loading = false;
            this.persistCustomerProfileFromBilling(formValue.billing);
            this.payFast.redirectToPayFast(res);
          },
          error: (err) => this.handleCheckoutError(err)
        });
      },
      error: (err) => this.handleCheckoutError(err)
    });
  }

  stripeCheckout() {
    const handler = (<any>window).StripeCheckout.configure({
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

  private createBillingAddressGroup(): UntypedFormGroup {
    return this.fb.group({
      customerName: ['', [trimRequired(), trimPersonName()]],
      customerMobileNo: ['', [trimRequired(), trimDigitsOnly()]],
      customerEmail: ['', [trimRequired(), this.trimEmailValidator]],
      address: ['', [trimRequired(), trimMaxLength(50)]],
      town: ['', trimRequired()],
      state: ['', trimRequired()],
      postalcode: ['', trimRequired()]
    });
  }

  private trimEmailValidator = (control: AbstractControl): ValidationErrors | null => {
    const value = (control.value ?? '').toString().trim();
    if (!value) {
      return null;
    }
    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailPattern.test(value) ? null : { email: true };
  };

  /** Shipping block has no email field — do not require customerEmail here. */
  private createShippingAddressGroup(): UntypedFormGroup {
    return this.fb.group({
      customerName: [''],
      customerMobileNo: [''],
      address: [''],
      town: [''],
      state: [''],
      postalcode: ['']
    });
  }

  private setShippingValidators(required: boolean): void {
    const rules = required
      ? {
          customerName: [trimRequired(), trimPersonName()],
          customerMobileNo: [trimRequired(), trimDigitsOnly()],
          address: [trimRequired(), trimMaxLength(50)],
          town: [trimRequired()],
          state: [trimRequired()],
          postalcode: [trimRequired()]
        }
      : {
          customerName: [],
          customerMobileNo: [],
          address: [],
          town: [],
          state: [],
          postalcode: []
        };

    Object.entries(rules).forEach(([key, validators]) => {
      const ctrl = this.shippingGroup.get(key);
      if (ctrl) {
        ctrl.setValidators(validators);
        ctrl.updateValueAndValidity();
      }
    });
  }

  private buildCheckoutPayload(): CheckoutFormValues {
    const raw = this.checkoutForm.value;
    const billing = raw.billing;
    const shipping = raw.shipToDifferentAddress
      ? { ...raw.shipping, customerEmail: billing.customerEmail }
      : billing;

    return {
      billing,
      shipping,
      shipToDifferentAddress: raw.shipToDifferentAddress,
      description: raw.description,
      shippingMethod: this.shippingMethod,
      paymentMethod: this.paymentMethod
    };
  }

  private clearCartAfterOrder(): void {
    this.productService.clearCart();
    this.products = [];
  }

  private handleCheckoutError(err: any): void {
    this.loading = false;
    const msg =
      err?.error?.error?.message ||
      err?.error?.message ||
      err?.message ||
      'Could not complete checkout. Please try again.';
    this.toastr.error(msg, this.translate.instant('toaster_Heading_Error'), { progressBar: true });
  }

  control(path: string): AbstractControl | null {
    return this.checkoutForm.get(path);
  }

  isInvalid(path: string): boolean {
    const ctrl = this.control(path);
    return !!(ctrl && ctrl.invalid && (ctrl.touched || ctrl.dirty));
  }

  trimField(group: 'billing' | 'shipping', field: string): void {
    const ctrl = this.checkoutForm.get(`${group}.${field}`);
    if (ctrl && typeof ctrl.value === 'string') {
      ctrl.setValue(ctrl.value.trim());
      ctrl.markAsTouched();
      ctrl.updateValueAndValidity();
    }
  }

  private prefillCheckoutCustomerDetails(): void {
    if (!this.auth.isLoggedIn()) {
      this.applyStoredCustomerProfile();
      return;
    }

    this.auth.refreshCustomerProfileFromSession().subscribe({
      next: () => {
        this.applyStoredCustomerProfile();
        this.loadBillingFromLastOrderIfMissing();
      },
      error: () => {
        this.applyStoredCustomerProfile();
        this.loadBillingFromLastOrderIfMissing();
      }
    });
  }

  private applyStoredCustomerProfile(): void {
    const profile = this.auth.getCustomerProfile();
    const email = profile?.customerEmail || this.auth.getCustomerEmail();

    if (!profile && !email) {
      return;
    }

    this.billingGroup.patchValue({
      customerName: profile?.customerName ?? '',
      customerMobileNo: profile?.customerMobileNo ?? '',
      customerEmail: email ?? '',
      address: profile?.address ?? '',
      town: profile?.town ?? '',
      state: profile?.state ?? '',
      postalcode: profile?.postalcode ?? ''
    });
  }

  private loadBillingFromLastOrderIfMissing(): void {
    const billing = this.billingGroup.value as CheckoutAddressFormValues;
    if (billing.address?.trim() && billing.customerMobileNo?.trim()) {
      return;
    }

    const email = this.auth.getCustomerEmail();
    if (!email) {
      return;
    }

    this.onlineShopOrder.getMyOrders(email, 0, 1).subscribe({
      next: (result) => {
        const latestOrder = result.items?.[0];
        if (!latestOrder?.id) {
          return;
        }

        this.onlineShopOrder.getMyOrderDetail(latestOrder.id, email).subscribe({
          next: (detail) => {
            const addr = detail.billingAddress ?? detail.shippingAddress;
            if (!addr) {
              return;
            }
            this.patchBillingFromOrderAddress(addr, billing);
          }
        });
      }
    });
  }

  private patchBillingFromOrderAddress(
    addr: OnlineShopSaleOrderAddress,
    current: CheckoutAddressFormValues
  ): void {
    const patch: Partial<CheckoutAddressFormValues> = {};

    if (!current.customerName?.trim() && addr.customerName) {
      patch.customerName = addr.customerName;
    }
    if (!current.customerMobileNo?.trim() && addr.phone) {
      patch.customerMobileNo = addr.phone;
    }
    if (!current.customerEmail?.trim() && addr.emailAddress) {
      patch.customerEmail = addr.emailAddress;
    }
    if (!current.address?.trim() && addr.address) {
      patch.address = addr.address;
    }
    if (!current.town?.trim() && addr.townCity) {
      patch.town = addr.townCity;
    }
    if (!current.state?.trim() && addr.stateCounty) {
      patch.state = addr.stateCounty;
    }
    if (!current.postalcode?.trim() && addr.postalCode) {
      patch.postalcode = addr.postalCode;
    }

    if (Object.keys(patch).length) {
      this.billingGroup.patchValue(patch);
      this.persistCustomerProfileFromBilling(this.billingGroup.value as CheckoutAddressFormValues);
    }
  }

  private persistCustomerProfileFromBilling(billing: CheckoutAddressFormValues): void {
    this.auth.saveCustomerProfile({
      customerName: billing.customerName,
      customerMobileNo: billing.customerMobileNo,
      customerEmail: billing.customerEmail,
      address: billing.address,
      town: billing.town,
      state: billing.state,
      postalcode: billing.postalcode
    });
  }
}
