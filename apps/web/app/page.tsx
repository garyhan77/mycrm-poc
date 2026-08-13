'use client';

import { FormEvent, useCallback, useEffect, useState } from 'react';
import { ApiError, bulkDeleteCustomers, listCustomers } from '@/lib/api';
import { Customer, SortOrder, SortableColumn } from '@/lib/types';
import CustomerTable from '@/components/CustomerTable';
import CustomerFormModal from '@/components/CustomerFormModal';

const PAGE_SIZE = 10;

export default function Home() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [searchInput, setSearchInput] = useState('');
  const [query, setQuery] = useState('');

  const [sortBy, setSortBy] = useState<SortableColumn>('createdAt');
  const [sortOrder, setSortOrder] = useState<SortOrder>('DESC');

  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [modalCustomer, setModalCustomer] = useState<Customer | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const fetchCustomers = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await listCustomers({
        q: query || undefined,
        page,
        limit: PAGE_SIZE,
        sortBy,
        sortOrder,
      });
      setCustomers(result.data);
      setTotal(result.total);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to load customers.');
    } finally {
      setLoading(false);
    }
  }, [query, page, sortBy, sortOrder]);

  useEffect(() => {
    fetchCustomers();
  }, [fetchCustomers]);

  function handleSearchSubmit(e: FormEvent) {
    e.preventDefault();
    setPage(1);
    setQuery(searchInput.trim());
  }

  function handleSortChange(column: SortableColumn) {
    if (sortBy === column) {
      setSortOrder((prev) => (prev === 'ASC' ? 'DESC' : 'ASC'));
    } else {
      setSortBy(column);
      setSortOrder('ASC');
    }
    setPage(1);
  }

  function toggleRow(id: number) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    setSelectedIds((prev) => {
      const allSelected = customers.length > 0 && customers.every((c) => prev.has(c.id));
      if (allSelected) {
        const next = new Set(prev);
        customers.forEach((c) => next.delete(c.id));
        return next;
      }
      const next = new Set(prev);
      customers.forEach((c) => next.add(c.id));
      return next;
    });
  }

  function openAddModal() {
    setModalCustomer(null);
    setModalOpen(true);
  }

  function openEditModal(customer: Customer) {
    setModalCustomer(customer);
    setModalOpen(true);
  }

  function closeModal() {
    setModalOpen(false);
    setModalCustomer(null);
  }

  function handleSaved() {
    closeModal();
    fetchCustomers();
  }

  async function handleDeleteSelected() {
    if (selectedIds.size === 0) return;
    if (!confirm(`Delete ${selectedIds.size} selected customer(s)? This cannot be undone from the UI.`)) {
      return;
    }
    setDeleting(true);
    try {
      await bulkDeleteCustomers(Array.from(selectedIds));
      setSelectedIds(new Set());
      await fetchCustomers();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to delete selected customers.');
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="min-h-screen bg-zinc-50 px-6 py-6 dark:bg-black">
      <div className="mx-auto max-w-7xl">
        <header className="mb-6">
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">MyCRM</h1>
        </header>

        <form onSubmit={handleSearchSubmit} className="mb-4 flex gap-2">
          <input
            type="text"
            className="input max-w-sm"
            placeholder="Search by name, email, or company…"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
          />
          <button
            type="submit"
            className="rounded bg-zinc-900 px-4 py-1.5 text-sm text-white hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
          >
            Search
          </button>
        </form>

        {error && (
          <div className="mb-4 rounded border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-300">
            {error}
          </div>
        )}

        <CustomerTable
          customers={customers}
          loading={loading}
          sortBy={sortBy}
          sortOrder={sortOrder}
          onSortChange={handleSortChange}
          selectedIds={selectedIds}
          onToggleRow={toggleRow}
          onToggleAll={toggleAll}
          onEditCustomer={openEditModal}
        />

        <div className="mt-3 flex items-center justify-between">
          <span className="text-sm text-zinc-500">{total} customer(s)</span>
          <div className="flex items-center gap-2 text-sm">
            <button
              type="button"
              className="rounded border border-zinc-300 px-2 py-1 disabled:opacity-40 dark:border-zinc-700"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
            >
              Previous
            </button>
            <span>
              Page {page} of {totalPages}
            </span>
            <button
              type="button"
              className="rounded border border-zinc-300 px-2 py-1 disabled:opacity-40 dark:border-zinc-700"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
            >
              Next
            </button>
          </div>
        </div>

        <div className="mt-4 flex gap-2">
          <button
            type="button"
            onClick={openAddModal}
            className="rounded bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700"
          >
            Add customer
          </button>
          <button
            type="button"
            onClick={handleDeleteSelected}
            disabled={selectedIds.size === 0 || deleting}
            className="rounded bg-red-600 px-4 py-2 text-sm text-white hover:bg-red-700 disabled:opacity-40"
          >
            {deleting ? 'Deleting…' : `Delete selected${selectedIds.size ? ` (${selectedIds.size})` : ''}`}
          </button>
        </div>
      </div>

      {modalOpen && (
        <CustomerFormModal customer={modalCustomer} onClose={closeModal} onSaved={handleSaved} />
      )}
    </div>
  );
}
