export interface ContrastTextOptions {
  lightText?: string;
  darkText?: string;
}

const DEFAULT_LIGHT = '#FFFFFF';
const DEFAULT_DARK = '#000000';

/** Pick white or black text for readable contrast on a solid background color. */
export function contrastTextOnBackground(
  backgroundColor?: string | null,
  options?: ContrastTextOptions
): string {
  const lightText = options?.lightText ?? DEFAULT_LIGHT;
  const darkText = options?.darkText ?? DEFAULT_DARK;
  const rgb = parseCssColor(backgroundColor);
  if (!rgb) {
    return lightText;
  }

  const bgLum = relativeLuminance(rgb.r, rgb.g, rgb.b);
  const whiteContrast = contrastRatio(bgLum, relativeLuminance(255, 255, 255));
  const blackContrast = contrastRatio(bgLum, relativeLuminance(0, 0, 0));

  return whiteContrast >= blackContrast ? lightText : darkText;
}

/** Alias — use for all status / chip text color bindings. */
export function getContrastTextColor(backgroundColor?: string | null): string {
  return contrastTextOnBackground(backgroundColor);
}

/** Alias — same as getContrastTextColor. */
export const getReadableTextColor = getContrastTextColor;

/** Background + readable text pair for inline styles. */
export function statusChipStyle(backgroundColor?: string | null): {
  backgroundColor: string;
  color: string;
} {
  const bg = normalizeColorInput(backgroundColor) || '#6c757d';
  return {
    backgroundColor: bg,
    color: getContrastTextColor(bg),
  };
}

function normalizeColorInput(color?: string | null): string | null {
  if (!color) {
    return null;
  }

  const value = color.trim();
  if (!value) {
    return null;
  }

  if (/^[0-9a-f]{3}$/i.test(value) || /^[0-9a-f]{6}$/i.test(value) || /^[0-9a-f]{8}$/i.test(value)) {
    return `#${value}`;
  }

  return value;
}

function parseCssColor(color?: string | null): { r: number; g: number; b: number } | null {
  const normalized = normalizeColorInput(color);
  if (!normalized) {
    return null;
  }

  const hexMatch = normalized.match(/^#([0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i);
  if (hexMatch) {
    let hex = hexMatch[1];
    if (hex.length === 3) {
      hex = hex.split('').map((ch) => ch + ch).join('');
    }
    if (hex.length === 8) {
      hex = hex.slice(0, 6);
    }
    return {
      r: parseInt(hex.slice(0, 2), 16),
      g: parseInt(hex.slice(2, 4), 16),
      b: parseInt(hex.slice(4, 6), 16),
    };
  }

  const rgbMatch = normalized.match(/^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i);
  if (rgbMatch) {
    return {
      r: Number(rgbMatch[1]),
      g: Number(rgbMatch[2]),
      b: Number(rgbMatch[3]),
    };
  }

  return null;
}

function contrastRatio(l1: number, l2: number): number {
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

function relativeLuminance(r: number, g: number, b: number): number {
  const [rs, gs, bs] = [r, g, b].map((channel) => {
    const normalized = channel / 255;
    return normalized <= 0.03928
      ? normalized / 12.92
      : Math.pow((normalized + 0.055) / 1.055, 2.4);
  });

  return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
}
