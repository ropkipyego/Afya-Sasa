const REDACTED_KEYS = new Set([
  'password',
  'newpassword',
  'currentpassword',
  'temporarypassword',
  'adminpassword',
  'token',
  'refreshtoken',
  'accesstoken',
]);

export function sanitizeAuditPayload(
  value: unknown,
  depth = 0,
): Record<string, unknown> | unknown[] | string | number | boolean | null {
  if (depth > 4 || value === null || value === undefined) {
    return null;
  }

  if (Array.isArray(value)) {
    return value.slice(0, 20).map((item) => sanitizeAuditPayload(item, depth + 1)) as unknown[];
  }

  if (typeof value !== 'object') {
    if (typeof value === 'string' && value.length > 500) {
      return `${value.slice(0, 500)}…`;
    }
    return value as string | number | boolean;
  }

  const output: Record<string, unknown> = {};
  for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
    if (REDACTED_KEYS.has(key.toLowerCase())) {
      output[key] = '[REDACTED]';
      continue;
    }
    output[key] = sanitizeAuditPayload(nested, depth + 1);
  }
  return output;
}

export function extractRecordId(
  params: Record<string, string | undefined> | undefined,
  body: unknown,
  response: unknown,
): string | null {
  if (params?.id) return params.id;
  if (params?.patientId) return params.patientId;

  if (body && typeof body === 'object' && 'id' in body) {
    const id = (body as { id?: unknown }).id;
    if (typeof id === 'string') return id;
  }

  if (response && typeof response === 'object' && 'id' in response) {
    const id = (response as { id?: unknown }).id;
    if (typeof id === 'string') return id;
  }

  return null;
}
