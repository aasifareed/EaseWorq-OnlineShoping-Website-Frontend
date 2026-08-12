import { NgModule } from '@angular/core';
import { CommonModule, NgOptimizedImage } from '@angular/common';
import { SharedModule } from '../shared/shared.module';
import { HomeRoutingModule } from './home-routing.module';

import { FashionOneComponent } from './fashion/fashion-one/fashion-one.component';

import { SliderComponent } from './widgets/slider/slider.component';
import { LogoComponent } from './widgets/logo/logo.component';

@NgModule({
  declarations: [
    FashionOneComponent,
    SliderComponent,
    LogoComponent,
  ],
  imports: [
    CommonModule,
    NgOptimizedImage,
    HomeRoutingModule,
    SharedModule
  ]
})
export class HomeModule { }
