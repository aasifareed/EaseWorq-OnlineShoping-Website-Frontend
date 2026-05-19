import { Component, OnDestroy, OnInit } from '@angular/core';
import { DomSanitizer, SafeHtml, Title, Meta } from '@angular/platform-browser';
import { ActivatedRoute, Router } from '@angular/router';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { OnlineShopPageService } from 'src/app/shared/services/online-shop-page.service';

@Component({
  selector: 'app-cms-page',
  templateUrl: './cms-page.component.html',
  styleUrls: ['./cms-page.component.scss'],
})
export class CmsPageComponent implements OnInit, OnDestroy {
  loading = true;
  notFound = false;
  pageTitle = '';
  safeContent: SafeHtml | null = null;
  private readonly destroy$ = new Subject<void>();

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private pageService: OnlineShopPageService,
    private sanitizer: DomSanitizer,
    private title: Title,
    private meta: Meta,
  ) {}

  ngOnInit(): void {
    this.route.paramMap.pipe(takeUntil(this.destroy$)).subscribe((params) => {
      const slug = params.get('slug');
      if (!slug) {
        this.router.navigate(['/pages/404']);
        return;
      }
      this.loadPage(slug);
    });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private loadPage(slug: string): void {
    this.loading = true;
    this.notFound = false;
    this.safeContent = null;

    this.pageService.getBySlug(slug).subscribe({
      next: (page) => {
        this.pageTitle = page.title;
        this.safeContent = this.sanitizer.bypassSecurityTrustHtml(page.content || '');
        this.applyMeta(page.metaTitle || page.title, page.metaDescription);
        this.loading = false;
      },
      error: () => {
        this.loading = false;
        this.notFound = true;
        this.title.setTitle('Page not found');
      },
    });
  }

  private applyMeta(metaTitle: string, metaDescription?: string): void {
    this.title.setTitle(metaTitle);
    if (metaDescription) {
      this.meta.updateTag({ name: 'description', content: metaDescription });
    }
  }
}
