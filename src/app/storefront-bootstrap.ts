import { Router } from '@angular/router';
import { TenantService } from './shared/services/tenant.service';
import { HomeBannerService } from './shared/services/home-banner.service';

export function storefrontBootstrapFactory(
  tenantService: TenantService,
  router: Router,
  homeBannerService: HomeBannerService,
): () => Promise<boolean> {
  return async () => {
    const ok = await tenantService.initialize(router);
    if (ok) {
      homeBannerService.warmup();
    }
    return ok;
  };
}
