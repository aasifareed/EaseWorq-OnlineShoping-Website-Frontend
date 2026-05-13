import { Component, OnInit, Input, HostListener } from '@angular/core';
import { ProductService } from '../../services/product.service';

@Component({
  selector: 'app-header-one',
  templateUrl: './header-one.component.html',
  styleUrls: ['./header-one.component.scss']
})
export class HeaderOneComponent implements OnInit {
  
  @Input() class: string='';
  // @Input() class: string;
  @Input() themeLogo: string = 'assets/images/icon/logo.png'; // Default Logo
  @Input() topbar: boolean = true; // Default True
  @Input() sticky: boolean = false; // Default false
  
  public stick: boolean = false;

  constructor(public productService: ProductService,) { }

  ngOnInit(): void {
    this.filterbyCategory();
  }

  // @HostListener Decorator
  @HostListener("window:scroll", [])
  onWindowScroll() {
    let number = window.pageYOffset || document.documentElement.scrollTop || document.body.scrollTop || 0;
  	if (number >= 150 && window.innerWidth > 400) { 
  	  this.stick = true;
  	} else {
  	  this.stick = false;
  	}
  }


  categories!: Category[];
  // categories: Category[] = this.CATEGORIES;
  activeCat: Category | null = null;
  isOpen = false;
 
  openMenu() {
    this.isOpen = true;
    // default highlight first item

  }
  filterbyCategory() {
  // get filterbyCategory() {
    // const category = CATEGORIES;
    this.productService.getCategories().subscribe({
      next:(resp) =>{
        this.categories = resp.result;
      }
    });
    // return category
  }
 
  closeMenu() {
    this.isOpen = false;
    this.activeCat = null;
  }
 
  setActive(cat: Category) {
    this.activeCat = cat;
  }


}
  // categories pannel 
  // src/app/shared/data/categories.data.ts

export interface Category {
  id: number;
  title: string;
  slug: string;
  image?: string;
  children?: Category[];
}