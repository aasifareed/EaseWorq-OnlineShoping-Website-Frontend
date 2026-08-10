import { Component, EventEmitter, Input, OnInit, Output } from '@angular/core';
import { Product } from '../../../../shared/classes/product';

@Component({
  selector: 'app-pagination',
  templateUrl: './pagination.component.html',
  styleUrls: ['./pagination.component.scss']
})
export class PaginationComponent implements OnInit {

  @Input() products: Product[] = [];
  @Input() paginate: any = {};
  @Input() pageSize: number = 0;
  @Input() TotalCount: number = 0;
  @Output() setPage: EventEmitter<any> = new EventEmitter<any>();

  constructor() { }

  ngOnInit(): void {
  }

  get summaryText(): string {
    const total = +(this.paginate?.totalItems ?? this.TotalCount ?? 0);
    if (!total) {
      return '';
    }
    const start = (this.paginate?.startIndex ?? 0) + 1;
    const end = (this.paginate?.endIndex ?? 0) + 1;
    return `Showing ${start}–${end} of ${total} products`;
  }

  pageSet(page: number) {
    this.setPage.emit(page);
  }
}
