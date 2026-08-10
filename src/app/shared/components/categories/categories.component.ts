import { Component, OnDestroy, OnInit } from '@angular/core';
import { Product } from '../../classes/product';
import { ProductService } from '../../services/product.service';
import { ActivatedRoute } from '@angular/router';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-categories',
  templateUrl: './categories.component.html',
  styleUrls: ['./categories.component.scss']
})
export class CategoriesComponent implements OnInit, OnDestroy {

  public products: Product[] = [];
  public collapse: boolean = true;
  public showAll = false;
  public readonly previewLimit = 6;
  activeSlug = '';
  category: any;

  private paramsSub?: Subscription;

  constructor(
    public productService: ProductService,
    private route: ActivatedRoute
  ) {
    this.productService.getProducts.subscribe(product => this.products = product);
  }

  ngOnInit(): void {
    this.paramsSub = this.route.queryParams.subscribe(params => {
      this.activeSlug = params['category'] ? String(params['category']) : '';
      this.showAll = false;
    });
    this.filterbyCategory();
  }

  ngOnDestroy(): void {
    this.paramsSub?.unsubscribe();
  }

  get categoryPathResolved(): any[] | null {
    if (!this.activeSlug || !this.category?.length) {
      return null;
    }
    return this.productService.findCategoryPathFlexible(this.category, this.activeSlug);
  }

  isOpen(cat: any): boolean {
    const path = this.categoryPathResolved;
    if (path?.length) {
      return path.some((p) => String(p.id) === String(cat.id));
    }
    return String(this.activeSlug) === String(cat.id);
  }

  isCategoryActive(node: any): boolean {
    if (!node || !this.activeSlug) {
      return false;
    }
    if (String(node.id) === String(this.activeSlug)) {
      return true;
    }
    const cur = this.navCurrent;
    if (cur && String(cur.id) === String(node.id)) {
      return true;
    }
    const slug = this.productService.normalizeCategoryKey(this.activeSlug);
    return (
      this.productService.normalizeCategoryKey(String(node.title)) === slug ||
      this.productService.normalizeCategoryKey(String(node.id)) === slug
    );
  }

  get navCurrent(): any | null {
    if (!this.activeSlug || !this.category?.length) {
      return null;
    }
    const path = this.categoryPathResolved;
    return path?.length ? path[path.length - 1] : null;
  }

  get navParent(): any | null {
    if (!this.activeSlug || !this.category?.length) {
      return null;
    }
    const path = this.categoryPathResolved;
    return path && path.length > 1 ? path[path.length - 2] : null;
  }

  get navChildren(): any[] {
    const cur = this.navCurrent;
    return Array.isArray(cur?.children) ? cur.children : [];
  }

  /** Microless back target: parent category, or root list when at top level. */
  get backLabel(): string {
    return this.navParent?.title ? String(this.navParent.title) : 'All Categories';
  }

  get backQueryParams(): Record<string, string> {
    if (this.navParent?.id !== undefined && this.navParent?.id !== null && this.navParent?.id !== '') {
      return { category: String(this.navParent.id) };
    }
    return {};
  }

  hasChildren(node: any): boolean {
    return Array.isArray(node?.children) && node.children.length > 0;
  }

  get visibleCategories(): any[] {
    const list = Array.isArray(this.category) ? this.category : [];
    if (this.showAll || list.length <= this.previewLimit) {
      return list;
    }
    return list.slice(0, this.previewLimit);
  }

  filterbyCategory() {
    this.productService.getCategories().subscribe({
      next: (resp) => {
        this.category = resp.result;
      }
    });
  }
}
