import { Component, OnInit, Input } from '@angular/core';
import { HomeSlider } from '../../../shared/data/slider';

@Component({
  selector: 'app-slider',
  templateUrl: './slider.component.html',
  styleUrls: ['./slider.component.scss']
})
export class SliderComponent implements OnInit {

  @Input() sliders: any[] = [];
  @Input() class = '';
  @Input() textClass = '';
  @Input() category = '';
  @Input() buttonText = 'Shop Now';
  @Input() buttonClass = '';

  constructor() { }

  ngOnInit(): void {
  }

  public HomeSliderConfig: any = HomeSlider;

  isExternalLink(slider: any): boolean {
    const raw = (slider?.linkUrl || slider?.LinkUrl || '').toString().trim();
    return /^https?:\/\//i.test(raw);
  }

  externalHref(slider: any): string {
    return (slider?.linkUrl || slider?.LinkUrl || '/shop').toString().trim();
  }

  /** Prefer banner linkUrl path; else Shop. */
  slideLink(slider: any): any[] | string {
    if (this.isExternalLink(slider)) {
      return ['/shop'];
    }
    const raw = (slider?.linkUrl || slider?.LinkUrl || '').toString().trim();
    if (!raw || raw === '#') {
      return ['/shop'];
    }
    const path = raw.split('?')[0];
    if (path.startsWith('/')) {
      return path;
    }
    return ['/shop'];
  }

  slideQueryParams(slider: any): Record<string, string> | null {
    if (this.isExternalLink(slider)) {
      return null;
    }
    const raw = (slider?.linkUrl || slider?.LinkUrl || '').toString().trim();
    if (raw && raw.includes('?')) {
      const qs = raw.split('?')[1] || '';
      const params: Record<string, string> = {};
      qs.split('&').forEach((pair) => {
        const [k, v] = pair.split('=');
        if (k) {
          params[decodeURIComponent(k)] = decodeURIComponent(v || '');
        }
      });
      return Object.keys(params).length ? params : null;
    }
    if (this.category) {
      return { category: this.category };
    }
    return null;
  }

  onSlideClick(event: MouseEvent, slider: any): void {
    if (!this.isExternalLink(slider)) {
      return;
    }
    event.preventDefault();
    window.location.href = this.externalHref(slider);
  }
}
