import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { TenantService } from '../shared/services/tenant.service';

@Component({
  selector: 'app-site-not-available',
  templateUrl: './site-not-available.component.html',
  styleUrls: ['./site-not-available.component.scss'],
})
export class SiteNotAvailableComponent implements OnInit {
  constructor(
    private tenantService: TenantService,
    private router: Router,
  ) {}

  ngOnInit(): void {
    void this.redirectIfStoreAvailable();
  }

  private async redirectIfStoreAvailable(): Promise<void> {
    if (this.tenantService.isStoreAvailable()) {
      await this.router.navigateByUrl('/home');
      return;
    }

    const available = await this.tenantService.recheckStoreAvailability(this.router);
    if (available) {
      await this.router.navigateByUrl('/home');
    }
  }
}
