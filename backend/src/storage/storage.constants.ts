/** Clinical file upload limits — enforced on presign and mirrored on the frontend. */
export const MAX_UPLOAD_BYTES = 25 * 1024 * 1024; // 25 MB

export const ALLOWED_UPLOAD_MIME_TYPES = new Set([
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
]);

export const ALLOWED_UPLOAD_EXTENSIONS = new Set([
  '.pdf',
  '.jpg',
  '.jpeg',
  '.png',
  '.webp',
  '.gif',
  '.doc',
  '.docx',
]);

export function assertAllowedUpload(input: { contentType: string; fileSize?: number; filename?: string }) {
  const contentType = input.contentType.toLowerCase().split(';')[0]?.trim() ?? '';
  if (!ALLOWED_UPLOAD_MIME_TYPES.has(contentType)) {
    throw new Error(
      `File type not allowed: ${contentType || 'unknown'}. Use PDF, JPEG, PNG, WebP, GIF, or Word documents.`,
    );
  }
  if (input.fileSize != null && input.fileSize > MAX_UPLOAD_BYTES) {
    throw new Error(`File exceeds maximum size of ${Math.round(MAX_UPLOAD_BYTES / (1024 * 1024))} MB.`);
  }
  if (input.filename) {
    const ext = input.filename.includes('.')
      ? `.${input.filename.split('.').pop()!.toLowerCase()}`
      : '';
    if (ext && !ALLOWED_UPLOAD_EXTENSIONS.has(ext)) {
      throw new Error(`File extension not allowed: ${ext}`);
    }
  }
}
