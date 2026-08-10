import { Component, Input, OnInit } from '@angular/core';

export interface BreadcrumbTrailItem {
  label: string;
  routerLink?: any[] | string;
  queryParams?: Record<string, any>;
  current?: boolean;
}

@Component({
  selector: 'app-breadcrumb',
  templateUrl: './breadcrumb.component.html',
  styleUrls: ['./breadcrumb.component.scss']
})
export class BreadcrumbComponent implements OnInit {

  @Input() title: string;
  @Input() breadcrumb: string;
  /** Optional richer trail. When set, replaces the simple Home / breadcrumb pair. */
  @Input() trail: BreadcrumbTrailItem[] | null = null;
  /** When false, hide the left page-title (useful on PDP where the main H1 is below). */
  @Input() showTitle = true;

  constructor() {}

  ngOnInit(): void {}

  get hasTrail(): boolean {
    return Array.isArray(this.trail) && this.trail.length > 0;
  }
}
