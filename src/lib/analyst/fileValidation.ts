/**
 * Shared file-size validation for analyst upload flows.
 *
 * The parse-document-text edge function has a practical limit around 15MB
 * after accounting for base64 encoding overhead. Enforcing on the client
 * saves a round trip and gives the user a clear error instead of a
 * generic "extraction failed".
 */

export const MAX_UPLOAD_BYTES = 15 * 1024 * 1024; // 15 MB

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export interface FileValidationResult {
  ok: boolean;
  error?: string;
}

export function validateUploadFile(
  file: File,
  opts: { maxBytes?: number } = {}
): FileValidationResult {
  const maxBytes = opts.maxBytes ?? MAX_UPLOAD_BYTES;
  if (file.size > maxBytes) {
    return {
      ok: false,
      error: `File is ${formatFileSize(file.size)} — the maximum is ${formatFileSize(maxBytes)}.`,
    };
  }
  if (file.size === 0) {
    return { ok: false, error: 'File is empty.' };
  }
  return { ok: true };
}
