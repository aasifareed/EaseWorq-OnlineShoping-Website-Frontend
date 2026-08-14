import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';

import { ProductLeftSidebarComponent } from './product/sidebar/product-left-sidebar/product-left-sidebar.component';

import { CollectionLeftSidebarComponent } from './collection/collection-left-sidebar/collection-left-sidebar.component';
import { CollectionRightSidebarComponent } from './collection/collection-right-sidebar/collection-right-sidebar.component';
import { CollectionNoSidebarComponent } from './collection/collection-no-sidebar/collection-no-sidebar.component';
import { CollectionInfinitescrollComponent } from './collection/collection-infinitescroll/collection-infinitescroll.component';

import { CartComponent } from './cart/cart.component';
import { WishlistComponent } from './wishlist/wishlist.component';
import { CompareComponent } from './compare/compare.component';
import { CheckoutComponent } from './checkout/checkout.component';
import { SuccessComponent } from './checkout/success/success.component';
import { FailureComponent } from './checkout/failure/failure.component';
import { PayFastReturnComponent } from './checkout/payfast-return/payfast-return.component';

import { Resolver } from '../shared/services/resolver.service';
import { authGuard } from '../shared/guards/auth.guard';

const routes: Routes = [
  {
    path: 'product/:slug',
    component: ProductLeftSidebarComponent,
    resolve: {
      data: Resolver
    }
  },
  {
    path: 'product/left/sidebar/:slug',
    redirectTo: 'product/:slug'
  },
  {
    path: '',
    component: CollectionLeftSidebarComponent
  },
  {
    path: 'left-sidebar',
    redirectTo: '',
    pathMatch: 'full'
  },
  {
    path: 'collection/left/sidebar',
    redirectTo: '',
    pathMatch: 'full'
  },
  {
    path: 'collection/right/sidebar',
    component: CollectionRightSidebarComponent
  },
  {
    path: 'collection/no/sidebar',
    component: CollectionNoSidebarComponent
  },
  {
    path: 'collection/infinitescroll',
    component: CollectionInfinitescrollComponent
  },
  {
    path: 'cart',
    component: CartComponent
  },
  {
    path: 'wishlist',
    component: WishlistComponent
  },
  {
    path: 'compare',
    component: CompareComponent
  },
  {
    path: 'checkout',
    component: CheckoutComponent,
    canActivate: [authGuard]
  },
  {
    path: 'checkout/payfast-return',
    component: PayFastReturnComponent
  },
  {
    path: 'checkout/success/:id',
    component: SuccessComponent
  },
  {
    path: 'checkout/failure/:id',
    component: FailureComponent
  },
  {
    path: 'checkout/failure',
    component: FailureComponent
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class ShopRoutingModule { }
