const EMPTY_GUID = '00000000-0000-0000-0000-000000000000';
const GUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function normalizeStoreGuid(value: unknown): string | undefined {
  const raw = value != null ? String(value).trim() : '';
  if (!raw || raw.toLowerCase() === 'null' || raw === EMPTY_GUID) {
    return undefined;
  }
  return GUID_PATTERN.test(raw) ? raw : undefined;
}

export function resolveStoreIdFromApiPayload(raw: Record<string, unknown>): string | undefined {
  const candidates = [
    raw.storeId,
    raw.StoreId,
    raw.customStoreId,
    raw.CustomStoreId,
    raw.onlineStoreId,
    raw.OnlineStoreId,
  ];

  for (const candidate of candidates) {
    const normalized = normalizeStoreGuid(candidate);
    if (normalized) {
      return normalized;
    }
  }

  return undefined;
}

export function isValidStoreGuid(value: unknown): boolean {
  return !!normalizeStoreGuid(value);
}
