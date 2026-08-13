import {
  Customer,
  CustomerFormInput,
  PaginatedCustomers,
  SortOrder,
  SortableColumn,
} from './types';

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api';

export class ApiError extends Error {
  status: number;
  details: string[];

  constructor(status: number, details: string | string[]) {
    const list = Array.isArray(details) ? details : [details];
    super(list.join(' '));
    this.status = status;
    this.details = list;
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...init?.headers },
  });

  if (res.status === 204) {
    return undefined as T;
  }

  const body = await res.json().catch(() => null);

  if (!res.ok) {
    const message = body?.message ?? res.statusText;
    throw new ApiError(res.status, message);
  }

  return body as T;
}

/** Drops empty-string fields so optional columns are stored as NULL rather than "". */
function cleanPayload(input: Partial<CustomerFormInput>): Record<string, unknown> {
  const cleaned: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(input)) {
    if (value !== '' && value !== undefined) {
      cleaned[key] = value;
    }
  }
  return cleaned;
}

export interface ListCustomersParams {
  q?: string;
  page?: number;
  limit?: number;
  sortBy?: SortableColumn;
  sortOrder?: SortOrder;
}

export function listCustomers(params: ListCustomersParams): Promise<PaginatedCustomers> {
  const search = new URLSearchParams();
  if (params.q) search.set('q', params.q);
  if (params.page) search.set('page', String(params.page));
  if (params.limit) search.set('limit', String(params.limit));
  if (params.sortBy) search.set('sortBy', params.sortBy);
  if (params.sortOrder) search.set('sortOrder', params.sortOrder);
  return request<PaginatedCustomers>(`/customers?${search.toString()}`);
}

export function createCustomer(input: Partial<CustomerFormInput>): Promise<Customer> {
  return request<Customer>('/customers', {
    method: 'POST',
    body: JSON.stringify(cleanPayload(input)),
  });
}

export function updateCustomer(
  id: number,
  input: Partial<CustomerFormInput>,
): Promise<Customer> {
  return request<Customer>(`/customers/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(cleanPayload(input)),
  });
}

export function bulkDeleteCustomers(ids: number[]): Promise<void> {
  return request<void>('/customers', {
    method: 'DELETE',
    body: JSON.stringify({ ids }),
  });
}
