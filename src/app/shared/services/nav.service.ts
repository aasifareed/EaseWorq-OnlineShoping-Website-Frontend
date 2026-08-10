import { Injectable, HostListener } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { STOREFRONT_ROUTES } from '../constants/storefront-routes';
import { OnlineShopHeaderMenuService } from './online-shop-header-menu.service';
import { TenantService } from './tenant.service';

// Menu
export type MegaColumnType = 'shop-all' | 'categories' | 'popular';

export interface Menu {
	path?: string | string[];
	title?: string;
	type?: string;
	megaMenu?: boolean;
	megaColumnType?: MegaColumnType;
	categoryLabel?: string;
	/** Root category id for mega menu (Shop All / default popular products). */
	mainCategoryId?: string;
	image?: string;
	active?: boolean;
	badge?: boolean;
	badgeText?: string;
	skipTranslate?: boolean;
	queryParams?: Record<string, string | number | boolean | null | undefined>;
	children?: Menu[];
}

@Injectable({
	providedIn: 'root'
})

export class NavService {

	private readonly BASE_MENU_ITEMS: Menu[] = [
		{ path: STOREFRONT_ROUTES.home, title: 'home', type: 'link' },
		{ path: STOREFRONT_ROUTES.shop, title: 'Shop', type: 'link' },
	];

	constructor(
		private headerMenuService: OnlineShopHeaderMenuService,
		private tenantService: TenantService,
	) {
		this.tenantService.whenReady().subscribe(() => this.loadDynamicMenus());
	}

	private menusLoading = false;
	private menusLoaded = false;

	loadDynamicMenus(): void {
		if (this.menusLoading || this.menusLoaded) {
			return;
		}
		this.menusLoading = true;
		this.headerMenuService.loadHeaderMenuItems().subscribe({
			next: (dynamicItems) => {
				this.items.next([...this.BASE_MENU_ITEMS, ...dynamicItems]);
				this.menusLoaded = true;
				this.menusLoading = false;
			},
			error: () => {
				this.menusLoading = false;
			},
		});
	}

	public screenWidth: any;
	public leftMenuToggle: boolean = false;
	public mainMenuToggle: boolean = false;

	// Windows width
	@HostListener('window:resize', ['$event'])
	// onResize(event?) {
	onResize(event?: any) {
		this.screenWidth = window.innerWidth;
	}

	LEFTMENUITEMS: Menu[] = [
		{
			title: 'clothing', type: 'sub', megaMenu: true, active: false, children: [
			  {
				  title: 'mens fashion',  type: 'link', active: false, children: [
					  { path: '/home', title: 'sports wear',  type: 'link' },
					  { path: '/home', title: 'top',  type: 'link' },
					  { path: '/home', title: 'bottom',  type: 'link' },
					  { path: '/home', title: 'ethic wear',  type: 'link' },
					  { path: '/home', title: 'sports wear',  type: 'link' },
					  { path: '/home', title: 'shirts',  type: 'link' },
					  { path: '/home', title: 'bottom',  type: 'link' },
					  { path: '/home', title: 'ethic wear',  type: 'link' },
					  { path: '/home', title: 'sports wear',  type: 'link' }
				  ]
			  },
			  {
				  title: 'women fashion',  type: 'link', active: false, children: [
					  { path: '/home', title: 'dresses',  type: 'link' },
					  { path: '/home', title: 'skirts',  type: 'link' },
					  { path: '/home', title: 'westarn wear',  type: 'link' },
					  { path: '/home', title: 'ethic wear',  type: 'link' },
					  { path: '/home', title: 'bottom',  type: 'link' },
					  { path: '/home', title: 'ethic wear',  type: 'link' },
					  { path: '/home', title: 'sports wear',  type: 'link' },
					  { path: '/home', title: 'sports wear',  type: 'link' },
					  { path: '/home', title: 'bottom wear',  type: 'link' }
				  ]
			  },
			]
		},
		{
			title: 'bags', type: 'sub', active: false, children: [
			  { path: '/home', title: 'shopper bags', type: 'link' },
			  { path: '/home', title: 'laptop bags', type: 'link' },
			  { path: '/home', title: 'clutches', type: 'link' },
			  {
				  path: '/home', title: 'purses', type: 'link', active: false, children: [
					  { path: '/home', title: 'purses',  type: 'link' },
					  { path: '/home', title: 'wallets',  type: 'link' },
					  { path: '/home', title: 'leathers',  type: 'link' },
					  { path: '/home', title: 'satchels',  type: 'link' }
				  ]
			  },
			]
		},
		{
			title: 'footwear', type: 'sub', active: false, children: [
			  { path: '/home', title: 'sport shoes', type: 'link' },
			  { path: '/home', title: 'formal shoes', type: 'link' },
			  { path: '/home', title: 'casual shoes', type: 'link' }
			]
		},
		{
			path: '/home', title: 'watches', type: 'link'
		},
		{
			title: 'Accessories', type: 'sub', active: false, children: [
			  { path: '/home', title: 'fashion jewellery', type: 'link' },
			  { path: '/home', title: 'caps and hats', type: 'link' },
			  { path: '/home', title: 'precious jewellery', type: 'link' },
			  {
				  path: '/home', title: 'more..', type: 'link', active: false, children: [
					  { path: '/home', title: 'necklaces',  type: 'link' },
					  { path: '/home', title: 'earrings',  type: 'link' },
					  { path: '/home', title: 'rings & wrist wear',  type: 'link' },
					  {
						  path: '/home', title: 'more...',  type: 'link', active: false, children: [
							  { path: '/home', title: 'ties',  type: 'link' },
							  { path: '/home', title: 'cufflinks',  type: 'link' },
							  { path: '/home', title: 'pockets squares',  type: 'link' },
							  { path: '/home', title: 'helmets',  type: 'link' },
							  { path: '/home', title: 'scarves',  type: 'link' },
							  {
								  path: '/home', title: 'more...',  type: 'link', active: false, children: [
									  { path: '/home', title: 'accessory gift sets',  type: 'link' },
									  { path: '/home', title: 'travel accessories',  type: 'link' },
									  { path: '/home', title: 'phone cases',  type: 'link' }
								  ]
							  },
						]
					  }
				  ]
			  },
			]
		},
		{
			path: '/home', title: 'house of design', type: 'link'
		},
		{
			title: 'beauty & personal care', type: 'sub', active: false, children: [
			  { path: '/home', title: 'makeup', type: 'link' },
			  { path: '/home', title: 'skincare', type: 'link' },
			  { path: '/home', title: 'premium beaty', type: 'link' },
			  {
				  path: '/home', title: 'more..', type: 'link', active: false, children: [
					  { path: '/home', title: 'fragrances',  type: 'link' },
					  { path: '/home', title: 'luxury beauty',  type: 'link' },
					  { path: '/home', title: 'hair care',  type: 'link' },
					  { path: '/home', title: 'tools & brushes',  type: 'link' }
				  ]
			  },
			]
		},
		{
			path: '/home', title: 'home & decor', type: 'link'
		},
		{
			path: '/home', title: 'kitchen', type: 'link'
		}
	];

	// Array
	items = new BehaviorSubject<Menu[]>([...this.BASE_MENU_ITEMS]);
	items$ = this.items.asObservable();
	
	// this.items$.next(this.MENUITEMS);
	leftMenuItems = new BehaviorSubject<Menu[]>(this.LEFTMENUITEMS);

}
