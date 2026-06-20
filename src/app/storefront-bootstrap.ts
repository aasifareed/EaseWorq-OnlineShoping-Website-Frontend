import { Router } from '@angular/router';
import { TenantService } from './shared/services/tenant.service';

export function storefrontBootstrapFactory(
  tenantService: TenantService,
  router: Router,
): () => Promise<boolean> {
  return () => tenantService.initialize(router);
}
