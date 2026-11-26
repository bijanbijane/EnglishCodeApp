const CURSOR_ID_PATTERN = /^[A-Za-z0-9_-]{1,128}$/;

export interface PageCursor {
  timestamp: string;
  id: string;
}

export function encodePageCursor(timestamp: string, id: string): string {
  return `${encodeURIComponent(timestamp)}~${encodeURIComponent(id)}`;
}

export function decodePageCursor(value: string): PageCursor | null {
  if (value.length < 8 || value.length > 512) return null;
  const parts = value.split("~");
  if (parts.length !== 2) return null;

  try {
    const timestamp = decodeURIComponent(parts[0]);
    const id = decodeURIComponent(parts[1]);
    const isIsoTimestamp = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\\.\d{3}Z$/.test(timestamp);
    const isSqliteTimestamp = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(timestamp);
    const normalizedTimestamp = isSqliteTimestamp
      ? `${timestamp.replace(" ", "T")}.000Z`
      : timestamp;
    const parsedTimestamp = new Date(normalizedTimestamp);

    if (
      timestamp.length > 64 ||
      (!isIsoTimestamp && !isSqliteTimestamp) ||
      !Number.isFinite(parsedTimestamp.getTime()) ||
      parsedTimestamp.toISOString() !== normalizedTimestamp ||
      !CURSOR_ID_PATTERN.test(id)
    ) return null;
    return { timestamp, id };
  } catch {
    return null;
  }
}
