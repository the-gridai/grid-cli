/**
 * Core API types for GRID Exchange
 * 
 * Base types used across all API endpoints
 */

/**
 * Standard API response wrapper from the Grid API
 */
export interface ApiResponse<T> {
  data: T;
  error?: ApiErrorResponse;
  meta?: ApiResponseMeta;
}

/**
 * Error response structure
 */
export interface ApiErrorResponse {
  code: string;
  message: string;
  details?: Record<string, any>;
}

/**
 * Pagination and metadata
 */
export interface ApiResponseMeta {
  page?: number;
  page_size?: number;
  total_count?: number;
  total_pages?: number;
}

/**
 * Filter parameter for API requests
 */
export interface ApiFilter {
  field: string;
  value: string | number;
  op?: 'eq' | 'neq' | 'gt' | 'gte' | 'lt' | 'lte' | 'in' | 'like';
}

/**
 * Pagination parameters
 */
export interface PaginationParams {
  page?: number;
  page_size?: number;
}

/**
 * Sorting parameters
 */
export interface SortParams {
  order_by?: string[];
  order_directions?: ('asc' | 'desc')[];
}

/**
 * Common query parameters
 */
export interface QueryParams extends PaginationParams, SortParams {
  filters?: Record<string, any>;
}
