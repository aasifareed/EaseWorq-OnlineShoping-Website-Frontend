import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { catchError, map, shareReplay, switchMap } from 'rxjs/operators';
import { environment } from 'src/environments/environment';
import {
  AbpResponse,
  CategoryTreeNode,
  HeaderMenuStorefront,
  HeaderMenuStorefrontItem,
} from '../models/online-shop-header-menu.model';
import { Menu } from './nav.service';
import { Product } from '../classes/product';
import { ProductService } from './product.service';
import { TenantService } from './tenant.service';
import { asBackgroundRequest } from '../interceptors/background-request';

const MAX_POPULAR_PRODUCTS = 20;

@Injectable({
  providedIn: 'root',
})
export class OnlineShopHeaderMenuService {
  private headerMenuItemsRequest$: Observable<Menu[]> | null = null;
  private readonly popularByCategory = new Map<string, Observable<Product[]>>();

  constructor(
    private http: HttpClient,
    private tenantService: TenantService,
    private productService: ProductService,
  ) {}

  loadHeaderMenuItems(force = false): Observable<Menu[]> {
    if (force) {
      this.headerMenuItemsRequest$ = null;
    }
    if (this.headerMenuItemsRequest$) {
      return this.headerMenuItemsRequest$;
    }

    this.headerMenuItemsRequest$ = this.tenantService.whenReady().pipe(
      switchMap(() =>
        this.fetchHeaderMenu().pipe(
          switchMap((header) =>
            this.fetchCategoryTree().pipe(
              map((categories) => this.buildMenuItems(header.dropdowns, categories)),
            ),
          ),
          catchError(() => of([])),
        ),
      ),
      shareReplay(1),
    );

    return this.headerMenuItemsRequest$;
  }

  private fetchHeaderMenu(): Observable<HeaderMenuStorefront> {
    const tenantId = this.resolveTenantId();
    const url = `${this.apiUrl(environment.urls.HeaderMenu_GetForStorefront)}?tenantId=${tenantId}`;
    // Header chrome: fills in around the page rather than holding the customer up.
    return this.http.get<AbpResponse<HeaderMenuStorefront>>(
      url,
      asBackgroundRequest(this.tenantHeaders(tenantId))
    ).pipe(
      map((response) => this.normalizeHeaderMenu(response?.result)),
      catchError(() => of({ tenantId, dropdowns: [] })),
    );
  }

  private fetchCategoryTree(): Observable<CategoryTreeNode[]> {
    return this.productService.getCategories().pipe(
      map((response: AbpResponse<CategoryTreeNode[]> | CategoryTreeNode[]) => {
        const raw = Array.isArray(response)
          ? response
          : (response?.result ?? []);
        return this.normalizeCategoryTree(raw);
      }),
      catchError(() => of([])),
    );
  }

  /** Build nav structure only — popular products load lazily on mega-menu open. */
  private buildMenuItems(
    dropdowns: HeaderMenuStorefrontItem[],
    categoryTree: CategoryTreeNode[],
  ): Menu[] {
    const configured = (dropdowns || [])
      .filter((d) => d.productGroupId && d.productGroupId !== 'undefined')
      .sort((a, b) => a.slot - b.slot);

    if (!configured.length) {
      return [];
    }

    const seenTitles = new Set<string>();
    const unique: Menu[] = [];

    for (const dropdown of configured) {
      const groupId = dropdown.productGroupId!;
      const node = this.findCategoryById(categoryTree, groupId);
      const categoryLabel = this.toDisplayName(
        node?.title,
        dropdown.categoryName,
        `Category ${dropdown.slot}`,
      );
      const title = this.normalizeNavLabel(categoryLabel);
      const key = String(title || '').trim().toLowerCase();
      if (!key || seenTitles.has(key)) {
        continue;
      }
      seenTitles.add(key);
      unique.push(this.buildDropdownMenu(title, categoryLabel, groupId, node));
      if (unique.length >= 5) {
        break;
      }
    }

    return unique;
  }

  private buildDropdownMenu(
    title: string,
    categoryLabel: string,
    groupId: string,
    node: CategoryTreeNode | null,
  ): Menu {
    const columns: Menu[] = [this.buildShopAllColumn(categoryLabel, groupId)];

    const subcategories = this.buildSubcategoriesColumn(node);
    if (subcategories) {
      columns.push(subcategories);
    }

    columns.push({
      title: 'Most Popular',
      type: 'sub',
      megaColumnType: 'popular',
      skipTranslate: true,
      active: false,
      children: [],
    });

    return {
      title,
      categoryLabel,
      mainCategoryId: groupId,
      type: 'sub',
      megaMenu: true,
      active: false,
      skipTranslate: true,
      children: columns,
    };
  }

  private buildShopAllColumn(categoryLabel: string, groupId: string): Menu {
    return {
      title: 'Shop All',
      type: 'sub',
      megaColumnType: 'shop-all',
      skipTranslate: true,
      active: false,
      children: [
        {
          title: `All ${categoryLabel}`,
          type: 'link',
          path: '/shop',
          queryParams: { category: groupId },
          skipTranslate: true,
        },
      ],
    };
  }

  private buildSubcategoriesColumn(node: CategoryTreeNode | null): Menu | null {
    const links = this.collectSubcategoryLinks(node);
    if (!links.length) {
      return null;
    }

    return {
      title: 'Subcategories',
      type: 'sub',
      megaColumnType: 'categories',
      skipTranslate: true,
      active: false,
      children: links,
    };
  }

  private collectSubcategoryLinks(node: CategoryTreeNode | null): Menu[] {
    const subs = (node?.children || []).filter((c) => c.id && c.title);
    const links: Menu[] = [];

    for (const sub of subs) {
      if (sub.children?.length) {
        for (const child of sub.children) {
          if (child.id && child.title) {
            links.push(this.buildCategoryLink(child));
          }
        }
      } else {
        links.push(this.buildCategoryLink(sub));
      }
    }

    return links;
  }

  getPopularProductLinks(categoryId: string): Observable<Menu[]> {
    return this.fetchProductsForCategory(categoryId).pipe(
      map((products) => this.mapProductsToMenuLinks(products)),
    );
  }

  private mapProductsToMenuLinks(products: Product[]): Menu[] {
    return (products || [])
      .filter((p) => p?.id && p?.title)
      .slice(0, MAX_POPULAR_PRODUCTS)
      .map((p) => ({
        title: p.title,
        type: 'link',
        path: p.slug
          ? ['/shop/product', p.slug]
          : ['/shop/product', String(p.id)],
        skipTranslate: true,
      }));
  }

  private buildCategoryLink(node: CategoryTreeNode): Menu {
    return {
      title: this.toDisplayName(node.title),
      type: 'link',
      path: '/shop',
      queryParams: { category: node.id },
      skipTranslate: true,
    };
  }

  private fetchProductsForCategory(categoryId: string): Observable<Product[]> {
    const key = String(categoryId || '').trim();
    if (!key) {
      return of([]);
    }

    const cached = this.popularByCategory.get(key);
    if (cached) {
      return cached;
    }

    const tenantId = this.resolveTenantId();
    const storeId = this.resolveStoreId();
    const path = `${environment.urls.OnlineShopAvailableProduct_GetAllAvailableProductsForOnlineShop}?TenantId=${tenantId}&StoreId=${encodeURIComponent(
      storeId,
    )}&CategoryId=${encodeURIComponent(key)}&maxResultCount=${MAX_POPULAR_PRODUCTS}&skipCount=0&ShopSortBy=ascending`;

    const request$ = this.productService.getProductsFromAPI(path).pipe(
      map((response: { result?: { items?: unknown[] } }) => {
        const items = response?.result?.items || [];
        return items.map((item) => this.productService.mapInventoryItemToProduct(item));
      }),
      catchError(() => of([] as Product[])),
      shareReplay(1),
    );

    this.popularByCategory.set(key, request$);
    return request$;
  }

  private findCategoryById(nodes: CategoryTreeNode[], id: string): CategoryTreeNode | null {
    for (const node of nodes) {
      if (String(node.id) === String(id)) {
        return node;
      }
      if (node.children?.length) {
        const found = this.findCategoryById(node.children, id);
        if (found) {
          return found;
        }
      }
    }
    return null;
  }

  private toDisplayName(...candidates: (string | undefined)[]): string {
    const raw = candidates.find((c) => c && String(c).trim()) || 'Category';
    return this.normalizeNavLabel(String(raw));
  }

  private normalizeNavLabel(raw: string): string {
    let s = String(raw || '')
      .trim()
      .replace(/\s*\/\s*/g, ' / ')
      .replace(/\s+/g, ' ');

    const acronyms = new Set(['tws', 'otg', 'usb', 'led', 'lcd', 'hd', 'gps', 'sim']);

    s = s
      .split(/\s+/)
      .map((w) => {
        if (w === '/' || w === '&') {
          return w;
        }
        const bare = w.replace(/[().,]/g, '');
        if (acronyms.has(bare.toLowerCase())) {
          return w.replace(bare, bare.toUpperCase());
        }
        return w.charAt(0).toUpperCase() + w.slice(1).toLowerCase();
      })
      .join(' ');

    s = s
      .replace(/\bAirbuds\b/gi, 'Earbuds')
      .replace(/\bAdaptors\b/gi, 'Adapters')
      .replace(/\s*\/\s*/g, ' & ');

    return s;
  }

  private normalizeHeaderMenu(raw: HeaderMenuStorefront | null | undefined): HeaderMenuStorefront {
    if (!raw) {
      return { tenantId: this.resolveTenantId(), dropdowns: [] };
    }
    const dropdowns = (raw.dropdowns || []).map((d: Record<string, unknown> | HeaderMenuStorefrontItem) => ({
      slot: Number((d as HeaderMenuStorefrontItem).slot ?? (d as Record<string, unknown>).Slot ?? 0),
      productGroupId: String(
        (d as HeaderMenuStorefrontItem).productGroupId ??
          (d as Record<string, unknown>).ProductGroupId ??
          '',
      ),
      categoryName: String(
        (d as HeaderMenuStorefrontItem).categoryName ??
          (d as Record<string, unknown>).CategoryName ??
          '',
      ),
    }));
    return {
      tenantId: Number(raw.tenantId ?? this.resolveTenantId()),
      dropdowns,
    };
  }

  private normalizeCategoryTree(raw: CategoryTreeNode[] | null | undefined): CategoryTreeNode[] {
    if (!raw?.length) {
      return [];
    }
    return raw.map((n) => this.normalizeCategoryNode(n as unknown as Record<string, unknown>));
  }

  private normalizeCategoryNode(raw: Record<string, unknown>): CategoryTreeNode {
    const childrenRaw = (raw.children ?? raw.Children) as Record<string, unknown>[] | undefined;
    return {
      id: String(raw.id ?? raw.Id ?? ''),
      title: String(raw.title ?? raw.Title ?? ''),
      parentGroupId: (raw.parentGroupId ?? raw.ParentGroupId) as string | null,
      count: Number(raw.count ?? raw.Count ?? 0),
      children: childrenRaw?.map((c) => this.normalizeCategoryNode(c)) || [],
    };
  }

  private resolveTenantId(): number {
    return this.tenantService.snapshot?.tenantId ?? 0;
  }

  private resolveStoreId(): string {
    return this.tenantService.snapshot?.storeId ?? '';
  }

  private apiUrl(path: string): string {
    const base = environment.baseUrl || '';
    const root = base.endsWith('/') ? base : `${base}/`;
    return `${root}api/services/app/${path}`;
  }

  private tenantHeaders(tenantId: number): { headers: HttpHeaders } {
    return {
      headers: new HttpHeaders({
        'Abp.TenantId': String(tenantId),
      }),
    };
  }
}
