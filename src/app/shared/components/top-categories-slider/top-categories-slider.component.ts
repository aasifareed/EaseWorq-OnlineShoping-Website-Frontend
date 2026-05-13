import { Component, Input, OnInit } from '@angular/core';

@Component({
  selector: 'app-top-categories-slider',
  templateUrl: './top-categories-slider.component.html',
  styleUrls: ['./top-categories-slider.component.scss']
})
export class TopCategoriesSliderComponent implements OnInit {
  @Input() gridMode: boolean = false;   // false = carousel, true = grid
  @Input() title: string = ''; 
// Slider config — 6 visible, no dots, with nav arrows
  categorySliderConfig = {
    // loop: true,
    // mouseDrag: true,
    // touchDrag: true,
    // pullDrag: false,
    // dots: false,
    // nav: true,
        loop: true,
    nav: true,
    dots: false,
  navContainerClass: 'owl-nav',
    // navSpeed: 500,
  navClass: [ 'owl-prev', 'owl-next' ],
    navText: [ '<i class="ti-angle-left"></i>', '<i class="ti-angle-right"></i>' ],
    responsive: {
      0:    { items: 2 },
      480:  { items: 3 },
      768:  { items: 4 },
      1024: { items: 6 }
    }
  };
 
  constructor() { }

  ngOnInit() {
  }

  // Categories — add/remove items here
  categories = [
    { name: 'Headphones',      url: '/headsets/',           image: 'https://uae.microless.com/cdn/categories/headsets.png' },
    { name: 'Monitors',        url: '/monitors/',           image: 'https://uae.microless.com/cdn/categories/monitors.png' },
    { name: 'Laptops',         url: '/laptops/',            image: 'https://uae.microless.com/cdn/categories/laptops.png' },
    { name: 'Computer Mouse',  url: '/computer-mouse/',     image: 'https://uae.microless.com/cdn/categories/computer-mouse.png' },
    { name: 'Keyboards',       url: '/keyboards/',          image: 'https://uae.microless.com/cdn/categories/keyboards.png' },
    { name: 'Mobile Phones',   url: '/mobile-phones/',      image: 'https://uae.microless.com/cdn/categories/mobile-phones.png' },
    { name: 'PCs',             url: '/desktop-pcs/',        image: 'https://uae.microless.com/cdn/categories/desktop-pcs.png' },
    { name: 'Computer Cases',  url: '/computer_cases/',     image: 'https://uae.microless.com/cdn/categories/computer_cases.png' },
    { name: 'Mouse Pads',      url: '/mouse-pads/',         image: 'https://uae.microless.com/cdn/categories/mouse-pads.png' },
    { name: 'Internal SSD',    url: '/ssd/',                image: 'https://uae.microless.com/cdn/categories/ssd.png' },
    { name: 'Power Supplies',  url: '/power_supplies/',     image: 'https://uae.microless.com/cdn/categories/power_supplies.png' },
    { name: 'Ethernet Cables', url: '/networking_cables/',  image: 'https://uae.microless.com/cdn/categories/networking_cables.png' },
  ];
 
}
