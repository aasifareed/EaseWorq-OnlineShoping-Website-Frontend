import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SharedModule } from 'src/app/shared/shared.module';
import { CmsPageRoutingModule } from './cms-page-routing.module';
import { CmsPageComponent } from './cms-page.component';

@NgModule({
  declarations: [CmsPageComponent],
  imports: [CommonModule, SharedModule, CmsPageRoutingModule],
})
export class CmsPageModule {}
