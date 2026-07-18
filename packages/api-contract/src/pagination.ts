/** 1-based page index for list query params. */
export const PAGE_MIN = 1;

/** Default `pageSize` when omitted. */
export const PAGE_SIZE_DEFAULT = 20;

/** Max `pageSize` accepted by list endpoints. */
export const PAGE_SIZE_MAX = 100;

/** Pagination metadata inside list `data` (not envelope `meta`). */
export type PageInfo = {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
};

/** List success `data` shape — wrapped by global `{ data, meta? }` envelope. */
export type Paginated<T> = {
  items: T[];
  pageInfo: PageInfo;
};

export function buildPageInfo(
  page: number,
  pageSize: number,
  total: number,
): PageInfo {
  const totalPages = total === 0 ? 0 : Math.ceil(total / pageSize);
  return { page, pageSize, total, totalPages };
}
