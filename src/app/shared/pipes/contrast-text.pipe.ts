import { Pipe, PipeTransform } from '@angular/core';
import { getContrastTextColor } from '../utils/color-contrast.util';

/** Returns #FFFFFF or #000000 for readable text on a solid background color. */
@Pipe({ name: 'contrastText' })
export class ContrastTextPipe implements PipeTransform {
  transform(backgroundColor?: string | null): string {
    return getContrastTextColor(backgroundColor);
  }
}
