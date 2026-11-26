import {
  decodePageCursor,
  encodePageCursor,
  type PageCursor,
} from "../../shared/pagination";

export type AdminPageCursor = PageCursor;
export const encodeAdminPageCursor = encodePageCursor;
export const decodeAdminPageCursor = decodePageCursor;
