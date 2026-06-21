import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { map, switchMap } from 'rxjs/operators';
import { environment } from 'src/environments/environment';
import { TenantService } from './tenant.service';

export interface SearchProductSuggestion {
  /** @deprecated Use productInventoryId */
  id: string;
  productId: string;
  productInventoryId: string;
  productName: string;
  name: string;
  slug: string;
  actualSellPrice?: number;
  pictureUrl?: string;
  imageUrl?: string;
  price?: number;
  productUnitStock?: number;
  stock?: number;
  isAvailable?: boolean;
  description?: string;
  categoryName?: string;
  categoryId?: string;
  brandId?: string;
  brandName?: string;
}

export interface SearchCategorySuggestion {
  id: string;
  name: string;
  parentName?: string;
}

export interface SearchSuggestionsResult {
  products: SearchProductSuggestion[];
  categories: SearchCategorySuggestion[];
}

@Injectable({ providedIn: 'root' })
export class OnlineShopSearchService {
  constructor(
    private http: HttpClient,
    private tenantService: TenantService,
  ) {}

  getSuggestions(query: string): Observable<SearchSuggestionsResult> {
    const q = (query || '').trim();
    if (q.length < 2) {
      return of({ products: [], categories: [] });
    }

    return this.tenantService.whenReady().pipe(
      switchMap((ctx) => {
        const tenantId = ctx.tenantId;
        const storeId = ctx.storeId;
        if (!storeId) {
          return of({ products: [], categories: [] });
        }

        const params = new HttpParams()
          .set('TenantId', String(tenantId))
          .set('StoreId', String(storeId))
          .set('Q', q);

        const url = `${environment.baseUrl}api/services/app/${environment.urls.OnlineShopSearch_GetSuggestions}`;
        return this.http.get<{ result: unknown }>(url, { params }).pipe(
          map((resp) => this.normalize(resp?.result)),
        );
      }),
    );
  }

  private normalize(raw: unknown): SearchSuggestionsResult {
    const r = (raw || {}) as Record<string, unknown>;
    const productsRaw = (r.products || r.Products || []) as Record<string, unknown>[];
    const categoriesRaw = (r.categories || r.Categories || []) as Record<string, unknown>[];

    return {
      products: productsRaw.map((p) => {
        const productInventoryId = String(
          p.productInventoryId ?? p.ProductInventoryId ?? p.id ?? p.Id ?? '',
        );
        const productId = String(p.productId ?? p.ProductId ?? '');
        const productName = String(p.productName ?? p.ProductName ?? p.name ?? p.Name ?? '').trim();
        const pictureUrl = (p.pictureUrl ?? p.PictureUrl ?? p.imageUrl ?? p.ImageUrl) as string | undefined;
        const actualSellPrice = (p.actualSellPrice ?? p.ActualSellPrice ?? p.price ?? p.Price) as number | undefined;
        const productUnitStock = (() => {
          const raw =
            p.productTotalQuantity ?? p.ProductTotalQuantity
            ?? p.productUnitStock ?? p.ProductUnitStock
            ?? p.stock ?? p.Stock;
          return raw != null ? Number(raw) : undefined;
        })();

        return {
          id: productInventoryId,
          productId,
          productInventoryId,
          productName,
          name: productName,
          slug: String(p.slug || p.Slug || productInventoryId),
          actualSellPrice,
          pictureUrl,
          imageUrl: pictureUrl,
          price: actualSellPrice,
          productUnitStock,
          stock: productUnitStock,
          isAvailable: this.toBoolean(p.isAvailable ?? p.IsAvailable, true),
          description: String(p.description || p.Description || '').trim() || undefined,
          categoryName: String(p.categoryName || p.CategoryName || '').trim() || undefined,
          categoryId: String(p.categoryId || p.CategoryId || '').trim() || undefined,
          brandId: String(p.brandId || p.BrandId || '').trim() || undefined,
          brandName: String(p.brandName || p.BrandName || '').trim() || undefined,
        };
      }),
      categories: categoriesRaw.map((c) => ({
        id: String(c.id || c.Id || ''),
        name: String(c.name || c.Name || '').trim(),
        parentName: String(c.parentName || c.ParentName || '').trim() || undefined,
      })),
    };
  }

  private toBoolean(value: unknown, fallback = false): boolean {
    if (value === undefined || value === null) {
      return fallback;
    }
    if (typeof value === 'boolean') {
      return value;
    }
    if (typeof value === 'string') {
      const normalized = value.trim().toLowerCase();
      if (normalized === 'true' || normalized === '1') {
        return true;
      }
      if (normalized === 'false' || normalized === '0') {
        return false;
      }
    }
    if (typeof value === 'number') {
      return value !== 0;
    }
    return fallback;
  }
}
