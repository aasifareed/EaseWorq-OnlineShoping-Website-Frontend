import { Component, OnInit } from '@angular/core';
import { ToastrService } from 'ngx-toastr';
import { AuthService } from '../../shared/services/auth.service';
import {
  OnlineShopOrderListItem,
  OnlineShopOrderService
} from '../../shared/services/online-shop-order.service';
import { TcsCourierService } from '../../shared/services/tcs-courier.service';

@Component({
  selector: 'app-tcs-integration-test',
  templateUrl: './tcs-integration-test.component.html',
  styleUrls: ['./tcs-integration-test.component.scss']
})
export class TcsIntegrationTestComponent implements OnInit {
  orderId = '';
  loading = false;
  lastResponse: unknown = null;
  lastError = '';

  orders: OnlineShopOrderListItem[] = [];
  ordersLoading = false;

  constructor(
    public auth: AuthService,
    private tcsCourier: TcsCourierService,
    private onlineShopOrder: OnlineShopOrderService,
    private toastr: ToastrService
  ) {}

  ngOnInit(): void {
    if (this.auth.isLoggedIn() && this.auth.getCustomerEmail()) {
      this.loadRecentOrders();
    }
  }

  loadRecentOrders(): void {
    const email = this.auth.getCustomerEmail();
    if (!email) {
      return;
    }
    this.ordersLoading = true;
    this.onlineShopOrder.getMyOrders(email, 0, 10).subscribe({
      next: (result) => {
        this.ordersLoading = false;
        this.orders = result.items || [];
      },
      error: () => {
        this.ordersLoading = false;
      }
    });
  }

  useOrder(order: OnlineShopOrderListItem): void {
    this.orderId = order.id;
    this.lastError = '';
    this.lastResponse = null;
  }

  createBookingFromOrder(): void {
    if (!this.orderId?.trim()) {
      this.toastr.warning('Enter an order id (GUID).');
      return;
    }

    this.loading = true;
    this.lastError = '';
    this.lastResponse = null;

    this.tcsCourier.createBookingFromOrder(this.orderId.trim()).subscribe({
      next: (result) => {
        this.loading = false;
        this.lastResponse = result;
        this.toastr.success(result.message || 'Booking request completed.');
      },
      error: (err) => {
        this.loading = false;
        this.lastResponse = null;
        this.lastError =
          err?.error?.error?.message
          || err?.error?.message
          || err?.message
          || 'Request failed.';
        this.toastr.error(this.lastError);
      }
    });
  }

  clearOutput(): void {
    this.lastResponse = null;
    this.lastError = '';
  }

  responseJson(): string {
    if (this.lastError) {
      return this.lastError;
    }
    if (this.lastResponse == null) {
      return '';
    }
    try {
      return JSON.stringify(this.lastResponse, null, 2);
    } catch {
      return String(this.lastResponse);
    }
  }
}
