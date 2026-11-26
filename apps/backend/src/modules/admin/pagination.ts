const CURSOR_ID_PATTERN = /^[A-Za-z0-9_-]{1,128}$/;

export interface AdminPageCursor {
  timestamp: string;
  id: string;
}

/**
 * Keyset cursor shared by admin read endpoints.
 * The timestamp is the leading sort key; the ID makes ties deterministic.
 */
export function encodeAdminPageCursor(timestamp: string, id: string): string {
  return `${encodeURIComponent(timestamp)}~${encodeURIComponent(id)}`;
}

export function decodeAdminPageCursor(value: string): AdminPageCursor | null {
  if (value.length < 8 || value.length > 512) return null;
  const parts = value.split("~");
  if (parts.length !== 2) return null;

  try {
    const timestamp = decodeURIComponent(parts[0]);
    const id = decodeURIComponent(parts[1]);
    if (timestamp.length > 64 || !Number.isFinite(Date.parse(timestamp)) ||
        !CURSOR_ID_PATTERN.test(id)) return null;
    return { timestamp, id };
  } catch {
    return null;
  }
}
