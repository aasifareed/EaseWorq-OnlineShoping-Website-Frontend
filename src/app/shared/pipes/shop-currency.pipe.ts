import { Pipe, PipeTransform } from '@angular/core';
import { formatNumber } from '@angular/common';

@Pipe({
  name: 'shopCurrency',
  standalone: false,
})
export class ShopCurrencyPipe implements PipeTransform {
  transform(value: number | string | null | undefined, currencySymbol: string = 'RS'): string {
    if (value === null || value === undefined || value === '') {
      return '';
    }

    const num = typeof value === 'number' ? value : Number(value);
    if (!Number.isFinite(num)) {
      return '';
    }

    const symbol = (currencySymbol || 'RS').trim() || 'RS';
    const formatted = formatNumber(num, 'en-US', '1.2-2');
    return `${symbol} ${formatted}`;
  }
}
