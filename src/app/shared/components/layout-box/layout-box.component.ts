import { Component, OnInit } from '@angular/core';

@Component({
  selector: 'app-layout-box',
  templateUrl: './layout-box.component.html',
  styleUrls: ['./layout-box.component.scss']
})
export class LayoutBoxComponent implements OnInit {
  
  public layoutsidebar: boolean = false;
  public activeItem: string='';

  constructor() { }

  ngOnInit(): void {
          document.body.classList.add('dark')

  }

  // Is active 
  isActive(menuItem:any) {
  	return this.activeItem === menuItem
  }

  // Sidebar Toggle
  layoutSidebarToggle() {
  	this.layoutsidebar = !this.layoutsidebar
  }

  // collapse
  opensettingcontent(val:any) {
  	if (this.activeItem === val) {
      this.activeItem = '';
    } else {
      this.activeItem = val;
    }
  }

  // Layout Type
  customizeLayoutType(val:any) {
    if(val == 'rtl') {
      document.body.classList.remove('ltr')
      document.body.classList.add('rtl')
    } else {
      document.body.classList.remove('rtl')
      document.body.classList.add('ltr')
    }
  }

  // Set Theme color
  customizeThemeColor(event:any) {
    document.documentElement.style.setProperty('--theme-deafult', event.target.value);
  }

  customizeLayoutDark() {
    document.body.classList.toggle('dark')
  }

}
