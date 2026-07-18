import type { Paginated } from "@cabin/api-contract";

/** 1-based page index — matches Nest `PaginationQueryDto`. */
export const INFINITE_INITIAL_PAGE = 1;

/** Next page for `useInfiniteQuery` from Nest `PageInfo`, or `undefined` when done. */
export function getNextPageParamFromPageInfo(
  lastPage: Paginated<unknown>,
): number | undefined {
  const { page, totalPages } = lastPage.pageInfo;
  return page < totalPages ? page + 1 : undefined;
}
