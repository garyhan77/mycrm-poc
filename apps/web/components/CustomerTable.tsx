'use client';

import { CUSTOMER_COLUMNS, Customer, SortOrder, SortableColumn } from '@/lib/types';

interface CustomerTableProps {
  customers: Customer[];
  loading: boolean;
  sortBy: SortableColumn;
  sortOrder: SortOrder;
  onSortChange: (column: SortableColumn) => void;
  selectedIds: Set<number>;
  onToggleRow: (id: number) => void;
  onToggleAll: () => void;
  onEditCustomer: (customer: Customer) => void;
}

function formatCell(customer: Customer, key: SortableColumn): string {
  const value = customer[key];
  if (value === null || value === undefined || value === '') return '—';
  if (key === 'createdAt' || key === 'updatedAt') {
    return new Date(value as string).toLocaleString();
  }
  if (key === 'lifetimeValue') {
    return `$${value}`;
  }
  return String(value);
}

export default function CustomerTable({
  customers,
  loading,
  sortBy,
  sortOrder,
  onSortChange,
  selectedIds,
  onToggleRow,
  onToggleAll,
  onEditCustomer,
}: CustomerTableProps) {
  const allSelected = customers.length > 0 && customers.every((c) => selectedIds.has(c.id));

  return (
    <div className="w-full overflow-x-auto border border-zinc-200 rounded-lg dark:border-zinc-800">
      <table className="min-w-max w-full text-sm text-left">
        <thead className="bg-zinc-50 dark:bg-zinc-900 sticky top-0">
          <tr>
            <th className="px-3 py-2 w-10">
              <input
                type="checkbox"
                checked={allSelected}
                onChange={onToggleAll}
                aria-label="Select all customers on this page"
              />
            </th>
            {CUSTOMER_COLUMNS.map((col) => (
              <th
                key={col.key}
                className="px-3 py-2 font-medium whitespace-nowrap cursor-pointer select-none hover:bg-zinc-100 dark:hover:bg-zinc-800"
                onClick={() => onSortChange(col.key)}
              >
                {col.label}
                {sortBy === col.key ? (sortOrder === 'ASC' ? ' ↑' : ' ↓') : ''}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {loading ? (
            <tr>
              <td colSpan={CUSTOMER_COLUMNS.length + 1} className="px-3 py-6 text-center text-zinc-500">
                Loading customers…
              </td>
            </tr>
          ) : customers.length === 0 ? (
            <tr>
              <td colSpan={CUSTOMER_COLUMNS.length + 1} className="px-3 py-6 text-center text-zinc-500">
                No customers found.
              </td>
            </tr>
          ) : (
            customers.map((customer) => (
              <tr
                key={customer.id}
                className="border-t border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-900"
              >
                <td className="px-3 py-2">
                  <input
                    type="checkbox"
                    checked={selectedIds.has(customer.id)}
                    onChange={() => onToggleRow(customer.id)}
                    aria-label={`Select ${customer.firstName} ${customer.lastName}`}
                  />
                </td>
                {CUSTOMER_COLUMNS.map((col) =>
                  col.key === 'firstName' ? (
                    <td key={col.key} className="px-3 py-2 whitespace-nowrap">
                      <button
                        type="button"
                        className="text-blue-600 hover:underline dark:text-blue-400"
                        onClick={() => onEditCustomer(customer)}
                      >
                        {customer.firstName}
                      </button>
                    </td>
                  ) : (
                    <td key={col.key} className="px-3 py-2 whitespace-nowrap max-w-xs truncate">
                      {formatCell(customer, col.key)}
                    </td>
                  ),
                )}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
