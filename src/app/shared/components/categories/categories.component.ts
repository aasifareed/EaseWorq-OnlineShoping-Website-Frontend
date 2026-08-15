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

  private expandedIds = new Set<string>();
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
      this.expandActivePath();
      this.ensureActiveParentVisible();
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

  isExpanded(cat: any): boolean {
    const id = this.nodeId(cat);
    return !!id && this.expandedIds.has(id);
  }

  toggleExpanded(event: Event, cat: any): void {
    event.preventDefault();
    event.stopPropagation();
    const id = this.nodeId(cat);
    if (!id) {
      return;
    }
    if (this.expandedIds.has(id)) {
      this.expandedIds.delete(id);
    } else {
      this.expandedIds.add(id);
    }
  }

  isCategoryActive(node: any): boolean {
    if (!node || !this.activeSlug) {
      return false;
    }
    if (String(node.id) === String(this.activeSlug)) {
      return true;
    }
    const slug = this.productService.normalizeCategoryKey(this.activeSlug);
    return (
      this.productService.normalizeCategoryKey(String(node.title)) === slug ||
      this.productService.normalizeCategoryKey(String(node.id)) === slug
    );
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
        this.expandActivePath();
        this.ensureActiveParentVisible();
      }
    });
  }

  private expandActivePath(): void {
    const path = this.categoryPathResolved;
    if (!path?.length) {
      return;
    }
    path.forEach((node) => {
      const id = this.nodeId(node);
      if (id && this.hasChildren(node)) {
        this.expandedIds.add(id);
      }
    });
  }

  private ensureActiveParentVisible(): void {
    if (!this.activeSlug || this.showAll) {
      return;
    }
    const list = Array.isArray(this.category) ? this.category : [];
    if (list.length <= this.previewLimit) {
      return;
    }
    const path = this.categoryPathResolved;
    const rootId = this.nodeId(path?.[0]);
    if (!rootId) {
      return;
    }
    const rootIndex = list.findIndex((cat) => this.nodeId(cat) === rootId);
    if (rootIndex >= this.previewLimit) {
      this.showAll = true;
    }
  }

  private nodeId(node: any): string {
    if (node?.id === undefined || node?.id === null || node?.id === '') {
      return '';
    }
    return String(node.id);
  }
}
