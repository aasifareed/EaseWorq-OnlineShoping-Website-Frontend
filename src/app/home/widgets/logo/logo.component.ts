import { Component, OnInit, Input } from '@angular/core';
import { LogoSlider } from '../../../shared/data/slider';

@Component({
  selector: 'app-logo',
  templateUrl: './logo.component.html',
  styleUrls: ['./logo.component.scss']
})
export class LogoComponent implements OnInit {
  
  @Input() logos: any[] = [];

  constructor() { }

  ngOnInit(): void {
  }

  public LogoSliderConfig: any = LogoSlider;

  isPlaceholderImage(imageUrl?: string): boolean {
    if (!imageUrl) {
      return true;
    }
    const normalized = imageUrl.toLowerCase();
    return normalized.includes('default-image')
      || normalized.includes('defaultattachments')
      || normalized.includes('placeholder');
  }

}
