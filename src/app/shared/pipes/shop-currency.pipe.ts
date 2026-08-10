import { Pipe, PipeTransform } from '@angular/core';
import { formatNumber } from '@angular/common';

@Pipe({
  name: 'shopCurrency',
  standalone: false,
})
export class ShopCurrencyPipe implements PipeTransform {
  transform(value: number | string | null | undefined, currencySymbol: string = 'Rs.'): string {
    if (value === null || value === undefined || value === '') {
      return '';
    }

    const num = typeof value === 'number' ? value : Number(value);
    if (!Number.isFinite(num)) {
      return '';
    }

    let symbol = (currencySymbol || 'Rs.').trim() || 'Rs.';
    // Normalize legacy / storefront symbols to retail style
    if (/^rs\.?$/i.test(symbol) || /^pkr$/i.test(symbol)) {
      symbol = 'Rs.';
    }

    const formatted = formatNumber(Math.round(num), 'en-US', '1.0-0');
    return `${symbol} ${formatted}`;
  }
}
