import type { PaginatedMeta, PaginatedResult } from './dto/pagination.dto';

export function normalizePagination(page = 1, pageSize = 20, maxPageSize = 100) {
  const safePage = Math.max(page, 1);
  const safePageSize = Math.min(Math.max(pageSize, 1), maxPageSize);
  return { page: safePage, pageSize: safePageSize };
}

export function paginatedResult<T>(
  items: T[],
  total: number,
  page: number,
  pageSize: number,
): PaginatedResult<T> {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const meta: PaginatedMeta = { page, pageSize, total, totalPages };
  return { items, meta };
}
