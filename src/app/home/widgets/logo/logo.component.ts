import { Component, Input } from '@angular/core';

@Component({
  selector: 'app-logo',
  templateUrl: './logo.component.html',
  styleUrls: ['./logo.component.scss']
})
export class LogoComponent {
  @Input() logos: any[] = [];

  isPlaceholderImage(imageUrl?: string): boolean {
    if (!imageUrl) {
      return true;
    }
    const normalized = imageUrl.toLowerCase();
    return normalized.includes('default-image')
      || normalized.includes('defaultattachments')
      || normalized.includes('placeholder')
      || normalized.includes('no-image');
  }
}
