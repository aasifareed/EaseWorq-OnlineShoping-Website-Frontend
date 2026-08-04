import { Component, OnInit, Input } from '@angular/core';

@Component({
  selector: 'app-stock-inventory',
  templateUrl: './stock-inventory.component.html',
  styleUrls: ['./stock-inventory.component.scss']
})
export class StockInventoryComponent implements OnInit {

  @Input() stock: any;

  get displayStock(): number {
    const parsed = Number(this.stock);
    return Number.isFinite(parsed) ? Math.max(0, Math.floor(parsed)) : 0;
  }

  get lowStockBarWidth(): number {
    const stock = this.displayStock;
    if (stock <= 0) {
      return 0;
    }
    return Math.min(100, Math.max(10, (stock / 5) * 95));
  }

  constructor() { }

  ngOnInit(): void {
  }

}
