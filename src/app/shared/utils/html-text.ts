/** Strip tags / entities so HTML descriptions can be tested or shown as plain text. */
export function stripHtml(value: string | null | undefined): string {
  if (!value) {
    return '';
  }
  return value
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

export function isBlankHtml(value: string | null | undefined): boolean {
  return !stripHtml(value);
}
