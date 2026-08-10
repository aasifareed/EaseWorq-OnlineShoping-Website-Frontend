import { Component, Input, OnInit } from '@angular/core';
import { ShippingRuleType } from '../../models/online-shop-discount.enum';
import { ShippingDeal, ShippingDealsService } from '../../services/shipping-deals.service';
import { describeWeight } from '../../utils/weight-format.util';

/** Treated as "and above" — admin rules use a large sentinel for the top tier. */
const OPEN_ENDED_MAX = 1000000;

@Component({
  selector: 'app-delivery-deals-banner',
  templateUrl: './delivery-deals-banner.component.html',
  styleUrls: ['./delivery-deals-banner.component.scss']
})
export class DeliveryDealsBannerComponent implements OnInit {
  @Input() heading = 'Delivery Deals';
  @Input() currencySymbol = 'Rs.';
  /** Inline, chrome-less rendering for tight spaces such as the top header bar. */
  @Input() compact = false;

  deals: ShippingDeal[] = [];

  constructor(private shippingDealsService: ShippingDealsService) {}

  ngOnInit(): void {
    this.shippingDealsService.getActiveDeals().subscribe({
      next: (deals) => {
        this.deals = deals || [];
      },
      error: () => {
        this.deals = [];
      }
    });
  }

  /** Country is only worth showing when deals span more than one country. */
  get showCountry(): boolean {
    const codes = new Set(this.deals.map((deal) => deal.countryCode).filter(Boolean));
    return codes.size > 1;
  }

  /**
   * The condition a shopper has to meet. A deal bands either on what they spend or on what the parcel
   * weighs, and the two read completely differently — "Rs. 5,000 & above" against "2 kg & above" — so
   * the unit has to follow the rule's own type rather than being assumed to be money.
   */
  spendLabel(deal: ShippingDeal): string {
    const isWeight = deal.ruleType === ShippingRuleType.BaseOnWeight;
    const from = isWeight ? describeWeight(deal.min) : this.money(deal.min);

    if (deal.max == null || deal.max >= OPEN_ENDED_MAX) {
      return `${from} & above`;
    }

    return `${from} – ${isWeight ? describeWeight(deal.max) : this.amount(deal.max)}`;
  }

  /**
   * A spend band is matched on what the order comes to after discounts, so a coupon can drop a cart out
   * of a band it looked like it had reached. Stated where the bands are advertised rather than left to
   * surprise the shopper at checkout.
   */
  get spendBasisNote(): string | null {
    const hasSpendBand = this.deals.some((deal) => deal.ruleType !== ShippingRuleType.BaseOnWeight);
    return hasSpendBand ? 'Order values count after discounts' : null;
  }

  benefitLabel(deal: ShippingDeal): string {
    switch (deal.chargeType) {
      case 'free':
        return 'FREE delivery';
      case 'percentage':
        return `${this.amount(deal.amount)}% off delivery`;
      case 'fixed':
        return `${this.money(deal.amount)} off delivery`;
      default:
        return 'Delivery discount';
    }
  }

  private money(value: number): string {
    return `${this.currencySymbol} ${this.amount(value)}`;
  }

  private amount(value: number): string {
    const num = Number(value);
    if (!Number.isFinite(num)) {
      return '0';
    }
    return Math.round(num).toLocaleString('en-US');
  }
}
