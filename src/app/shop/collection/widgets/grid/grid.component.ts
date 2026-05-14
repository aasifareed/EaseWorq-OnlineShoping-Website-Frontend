import { Component, OnInit, Input, Output, EventEmitter } from '@angular/core';
import { Product } from '../../../../shared/classes/product';

export interface CollectionToolbarBreadcrumb {
  label: string;
  routerLink?: any[];
  queryParams?: Record<string, unknown>;
  current?: boolean;
}

@Component({
  selector: 'app-grid',
  templateUrl: './grid.component.html',
  styleUrls: ['./grid.component.scss']
})
export class GridComponent implements OnInit {

  @Input() products: Product[] = [];
  @Input() paginate: any = {};
  @Input() pageSize: number = 0;
  @Input() TotalCount: number = 0;
  @Input() layoutView: string = 'grid-view';
  @Input() sortBy: string;
  /** Inline trail: Home > … > current (Microless-style toolbar). */
  @Input() breadcrumbTrail: CollectionToolbarBreadcrumb[] = [];

  @Output() setGrid: EventEmitter<any> = new EventEmitter<any>();
  @Output() setLayout: EventEmitter<any> = new EventEmitter<any>();
  @Output() sortedBy: EventEmitter<any> = new EventEmitter<any>();

  constructor() { }

  ngOnInit(): void {
  }

  get rangeStart(): number {
    if (!this.TotalCount) {
      return 0;
    }
    const page = +(this.paginate?.currentPage || 1);
    const ps = +(this.pageSize || 20);
    return (page - 1) * ps + 1;
  }

  get rangeEnd(): number {
    if (!this.TotalCount) {
      return 0;
    }
    const page = +(this.paginate?.currentPage || 1);
    const ps = +(this.pageSize || 20);
    return Math.min(page * ps, +this.TotalCount);
  }

  setGridLayout(value: string) {
    this.setGrid.emit(value);  // Set Grid Size
  }

  setLayoutView(value: string) {
    this.layoutView = value
    this.setLayout.emit(value); // Set layout view
  }

  sorting(event:any) {
    this.sortedBy.emit(event.target.value)
  }

}
