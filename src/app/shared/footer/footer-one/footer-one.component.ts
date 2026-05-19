import { Component, OnInit, Input } from '@angular/core';
import { OnlineShopPageMenuItem } from '../../models/online-shop-page.model';
import { OnlineShopPageService } from '../../services/online-shop-page.service';

@Component({
  selector: 'app-footer-one',
  templateUrl: './footer-one.component.html',
  styleUrls: ['./footer-one.component.scss']
})
export class FooterOneComponent implements OnInit {

  @Input() class: string = 'footer-light' // Default class 
  @Input() themeLogo: string = 'assets/images/icon/logo.png' // Default Logo
  @Input() newsletter: boolean = true; // Default True

  public today: number = Date.now();
  public footerPages: OnlineShopPageMenuItem[] = [];

  constructor(private pageService: OnlineShopPageService) { }

  ngOnInit(): void {
    this.pageService.getActivePages().subscribe({
      next: (pages) => {
        this.footerPages = pages || [];
      },
      error: () => {
        this.footerPages = [];
      },
    });
  }

  pageLink(slug: string): string[] {
    return this.pageService.pageLink(slug);
  }

}
