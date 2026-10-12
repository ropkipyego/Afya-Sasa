const SECRET_PATTERNS = [
  /pass(word)?[=:]\s*\S+/gi,
  /pwd[=:]\s*\S+/gi,
  /secret[=:]\s*\S+/gi,
  /token[=:]\s*\S+/gi,
  /Bearer\s+\S+/gi,
];

export function redactSecrets(input: string, extraSecrets: Array<string | null | undefined> = []): string {
  let output = input;
  for (const secret of extraSecrets) {
    if (secret && secret.length >= 3) {
      output = output.split(secret).join('[REDACTED]');
    }
  }
  for (const pattern of SECRET_PATTERNS) {
    output = output.replace(pattern, '[REDACTED]');
  }
  return output.slice(0, 400);
}

export function emailFingerprint(email: string): string {
  return email.trim().toLowerCase();
}

export function emailDomain(email: string): string {
  const at = email.lastIndexOf('@');
  return at >= 0 ? email.slice(at + 1).toLowerCase() : 'unknown';
}
