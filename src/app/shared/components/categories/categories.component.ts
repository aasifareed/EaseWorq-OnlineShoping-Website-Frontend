import { Component, OnInit } from '@angular/core';
import { Product } from '../../classes/product';
import { ProductService } from '../../services/product.service';
import { ActivatedRoute } from '@angular/router';

@Component({
  selector: 'app-categories',
  templateUrl: './categories.component.html',
  styleUrls: ['./categories.component.scss']
})
export class CategoriesComponent implements OnInit {

  public products: Product[] = [];
  public collapse: boolean = true;
activeSlug = '';
  category: any;
  constructor(public productService: ProductService,private route: ActivatedRoute) { 
    this.productService.getProducts.subscribe(product => this.products = product);
  }

  ngOnInit(): void {
      this.route.queryParams.subscribe(params => {
    this.activeSlug = params['category'] || '';
  });
  this.filterbyCategory();
  }

// activeSlug = '';
 
// Call this in your queryParams subscription
setActiveSlug(slug: string) {
  this.activeSlug = slug || '';
}
 
// Used in template — opens a node if it or any descendant is active
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
    return cur?.children || [];
  }

  filterbyCategory() {
  // get filterbyCategory() {
    // const category = CATEGORIES;
    this.productService.getCategories().subscribe({
      next:(resp) =>{
        this.category = resp.result;
      }
    });
    // return category
  }
  // : Category[]

}
