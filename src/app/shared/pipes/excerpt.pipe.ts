import { Pipe, PipeTransform } from '@angular/core';
import { stripHtml } from '../utils/html-text';

@Pipe({ name: 'excerpt' })
export class ExcerptPipe implements PipeTransform {
  transform(text: string | null | undefined, limit = 30): string {
    const plain = stripHtml(text);
    if (!plain) {
      return '';
    }
    if (plain.length <= limit) {
      return plain;
    }
    return `${plain.substring(0, limit)}...`;
  }
}
