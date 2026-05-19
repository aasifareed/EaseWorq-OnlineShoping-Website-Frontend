import { Injectable } from '@angular/core';
import { ActivatedRouteSnapshot, Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { Product } from '../classes/product';
import { ProductService } from './product.service';

@Injectable({
  providedIn: 'root'
})
export class Resolver {

  constructor(
    private router: Router,
    public productService: ProductService
  ) {}

  async resolve(route: ActivatedRouteSnapshot): Promise<Product> {
    const key = route.paramMap.get('slug') ?? route.params['slug'];
    const slug = String(key ?? '');

    const navState = typeof history !== 'undefined'
      ? (history.state as { product?: Product })?.product
      : undefined;
    if (navState && slug && String(navState.id) === slug) {
      return { ...navState };
    }

    const product = await firstValueFrom(this.productService.resolveProductForShop(slug));
    if (product?.title) {
      return product;
    }

    if (this.isInventoryGuid(slug)) {
      return { id: slug };
    }

    await this.router.navigateByUrl('/pages/404', { skipLocationChange: true });
    return {};
  }

  private isInventoryGuid(value: string): boolean {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
  }
}
