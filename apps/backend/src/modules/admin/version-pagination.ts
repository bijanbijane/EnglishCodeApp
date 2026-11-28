const CURSOR_ID_PATTERN = /^[A-Za-z0-9_:-]{1,128}$/;

export interface AuthorVersionCursor {
  version: number;
  id: string;
}

export function encodeAuthorVersionCursor(version: number, id: string): string {
  return `${version}~${encodeURIComponent(id)}`;
}

export function decodeAuthorVersionCursor(value: string): AuthorVersionCursor | null {
  if (value.length < 3 || value.length > 256) return null;
  const parts = value.split("~");
  if (parts.length !== 2 || !/^[1-9][0-9]{0,9}$/.test(parts[0])) return null;

  try {
    const version = Number(parts[0]);
    const id = decodeURIComponent(parts[1]);
    if (!Number.isSafeInteger(version) || !CURSOR_ID_PATTERN.test(id)) return null;
    return { version, id };
  } catch {
    return null;
  }
}
