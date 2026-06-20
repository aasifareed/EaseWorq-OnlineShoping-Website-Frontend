import { Pipe, PipeTransform } from '@angular/core';

@Pipe({ name: 'excerpt' })
export class ExcerptPipe implements PipeTransform {
  transform(text: string | null | undefined, limit = 30): string {
    if (!text) {
      return '';
    }
    if (text.length <= limit) {
      return text;
    }
    return `${text.substring(0, limit)}...`;
  }
}
