import { Component, OnInit, Input, Output, EventEmitter } from '@angular/core';
import { Product } from '../../../../shared/classes/product';

@Component({
  selector: 'app-colors',
  templateUrl: './colors.component.html',
  styleUrls: ['./colors.component.scss']
})
export class ColorsComponent implements OnInit {

  @Input() products: Product[] = [];
  @Input() colors: any[] = [];

  @Output() colorsFilter  : EventEmitter<any> = new EventEmitter<any>();
  
  public collapse: boolean = true;

  constructor() { 
  }

  ngOnInit(): void {
  }

  get filterbycolor() {
    const uniqueColors:any[] = [];
    this.products.filter((product:any) => {
      product?.variants?.filter((variant:any) => {
        if (variant.color) {
          const index = uniqueColors.indexOf(variant.color)
          if (index === -1) uniqueColors.push(variant.color)
        }
      })
    })
    return uniqueColors
  }

  appliedFilter(event:any) {
    let index = this.colors.indexOf(event.target.value);  // checked and unchecked value
    if (event.target.checked)   
        this.colors.push(event.target.value); // push in array cheked value
    else 
        this.colors.splice(index,1);  // removed in array unchecked value
    
    let colors = this.colors.length ? { color: this.colors.join(",") } : { color: null };    
    this.colorsFilter.emit(colors);
  }

  // check if the item are selected
  checked(item:any){
    if(this.colors.indexOf(item) != -1){
      return true;
    }
  }

}
