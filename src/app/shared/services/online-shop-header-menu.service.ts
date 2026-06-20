import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, forkJoin, of } from 'rxjs';
import { catchError, map, switchMap } from 'rxjs/operators';
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

const MAX_POPULAR_PRODUCTS = 20;

@Injectable({
  providedIn: 'root',
})
export class OnlineShopHeaderMenuService {
  constructor(
    private http: HttpClient,
    private tenantService: TenantService,
    private productService: ProductService,
  ) {}

  loadHeaderMenuItems(): Observable<Menu[]> {
    return this.tenantService.whenReady().pipe(
      switchMap(() =>
        forkJoin({
          header: this.fetchHeaderMenu(),
          categories: this.fetchCategoryTree(),
        }).pipe(
          switchMap(({ header, categories }) => this.buildMenuItems(header.dropdowns, categories)),
          catchError(() => of([])),
        ),
      ),
    );
  }

  private fetchHeaderMenu(): Observable<HeaderMenuStorefront> {
    const tenantId = this.resolveTenantId();
    const url = `${this.apiUrl(environment.urls.HeaderMenu_GetForStorefront)}?tenantId=${tenantId}`;
    return this.http.get<AbpResponse<HeaderMenuStorefront>>(url, this.tenantHeaders(tenantId)).pipe(
      map((response) => this.normalizeHeaderMenu(response?.result)),
      catchError(() => of({ tenantId, dropdowns: [] })),
    );
  }

  private fetchCategoryTree(): Observable<CategoryTreeNode[]> {
    const tenantId = this.resolveTenantId();
    const storeId = this.resolveStoreId();
    const url = `${this.apiUrl(
      environment.urls.OnlineShopProductGroup_GetHierarchyForOnline,
    )}?TenantId=${tenantId}&StoreId=${encodeURIComponent(storeId)}`;
    return this.http.get<AbpResponse<CategoryTreeNode[]>>(url).pipe(
      map((response) => this.normalizeCategoryTree(response?.result)),
      catchError(() => of([])),
    );
  }

  private buildMenuItems(
    dropdowns: HeaderMenuStorefrontItem[],
    categoryTree: CategoryTreeNode[],
  ): Observable<Menu[]> {
    const configured = (dropdowns || [])
      .filter((d) => d.productGroupId && d.productGroupId !== 'undefined')
      .sort((a, b) => a.slot - b.slot);

    if (!configured.length) {
      return of([]);
    }

    const productRequests = configured.map((d) =>
      this.fetchProductsForCategory(d.productGroupId!).pipe(
        map((products) => ({ slot: d.slot, products })),
      ),
    );

    return forkJoin(productRequests).pipe(
      map((productResults) => {
        const productsBySlot = new Map(productResults.map((r) => [r.slot, r.products]));
        return configured.map((dropdown) => {
          const groupId = dropdown.productGroupId!;
          const node = this.findCategoryById(categoryTree, groupId);
          const categoryLabel = this.toDisplayName(
            node?.title,
            dropdown.categoryName,
            `Category ${dropdown.slot}`,
          );
          const title = categoryLabel.toUpperCase();
          const products = productsBySlot.get(dropdown.slot) || [];
          return this.buildDropdownMenu(title, categoryLabel, groupId, node, products);
        });
      }),
    );
  }

  private buildDropdownMenu(
    title: string,
    categoryLabel: string,
    groupId: string,
    node: CategoryTreeNode | null,
    products: Product[],
  ): Menu {
    const columns: Menu[] = [this.buildShopAllColumn(categoryLabel, groupId)];

    const subcategories = this.buildSubcategoriesColumn(node);
    if (subcategories) {
      columns.push(subcategories);
    }

    const popular = this.buildPopularColumn(products);
    if (popular) {
      columns.push(popular);
    }

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
          path: '/shop/collection/left/sidebar',
          queryParams: { category: groupId },
          skipTranslate: true,
        },
      ],
    };
  }

  /** Single column listing all subcategories (one navigable level). */
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

  private buildPopularColumn(products: Product[]): Menu | null {
    const links = this.mapProductsToMenuLinks(products);
    if (!links.length) {
      return null;
    }

    return {
      title: 'Most Popular',
      type: 'sub',
      megaColumnType: 'popular',
      skipTranslate: true,
      active: false,
      children: links,
    };
  }

  private mapProductsToMenuLinks(products: Product[]): Menu[] {
    return (products || [])
      .filter((p) => p?.id && p?.title)
      .slice(0, MAX_POPULAR_PRODUCTS)
      .map((p) => ({
        title: p.title,
        type: 'link',
        path: ['/shop/product/left/sidebar', String(p.id)],
        skipTranslate: true,
      }));
  }

  private buildCategoryLink(node: CategoryTreeNode): Menu {
    return {
      title: this.toDisplayName(node.title),
      type: 'link',
      path: '/shop/collection/left/sidebar',
      queryParams: { category: node.id },
      skipTranslate: true,
    };
  }

  private fetchProductsForCategory(categoryId: string): Observable<Product[]> {
    const tenantId = this.resolveTenantId();
    const storeId = this.resolveStoreId();
    const path = `${environment.urls.OnlineShopAvailableProduct_GetAllAvailableProductsForOnlineShop}?TenantId=${tenantId}&StoreId=${encodeURIComponent(
      storeId,
    )}&CategoryId=${encodeURIComponent(categoryId)}&maxResultCount=${MAX_POPULAR_PRODUCTS}&skipCount=0&ShopSortBy=ascending`;

    return this.productService.getProductsFromAPI(path).pipe(
      map((response: { result?: { items?: unknown[] } }) => {
        const items = response?.result?.items || [];
        return items.map((item) => this.productService.mapInventoryItemToProduct(item));
      }),
      catchError(() => of([] as Product[])),
    );
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
    return String(raw)
      .trim()
      .split(/\s+/)
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
      .join(' ');
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
