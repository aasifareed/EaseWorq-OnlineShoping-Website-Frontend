/** ABP wraps API payloads as { result, success, error, __abp }. */

export interface AbpAjaxResponse {
  result?: unknown;
  success?: boolean;
  error?: {
    code?: number;
    message?: string;
    details?: string;
    validationErrors?: Array<{ message?: string }>;
  };
  unAuthorizedRequest?: boolean;
  __abp?: boolean;
}

export function isAbpFailure(body: unknown): body is AbpAjaxResponse {
  if (!body || typeof body !== 'object') {
    return false;
  }
  const ajax = body as AbpAjaxResponse;
  return ajax.success === false || (!!ajax.__abp && !!ajax.error?.message && ajax.result == null);
}

export function extractAbpErrorMessage(
  err: unknown,
  fallback = 'Something went wrong. Please try again.'
): string {
  const asAny = err as {
    error?: AbpAjaxResponse | string;
    message?: string;
  };
  const body: AbpAjaxResponse | undefined =
    asAny?.error && typeof asAny.error === 'object'
      ? asAny.error
      : isAbpFailure(err)
        ? (err as AbpAjaxResponse)
        : undefined;

  const validation = body?.error?.validationErrors
    ?.map((v) => v?.message)
    .filter((m): m is string => !!m?.trim());

  const msg =
    body?.error?.message ||
    validation?.[0] ||
    (typeof asAny?.error === 'string' ? asAny.error : '') ||
    body?.error?.details?.split('\r\n')[0] ||
    asAny?.message;

  if (typeof msg === 'string') {
    const trimmed = msg.trim();
    if (trimmed && !trimmed.startsWith('Http failure')) {
      return trimmed;
    }
  }

  return fallback;
}
