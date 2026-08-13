'use client';

import { FormEvent, useEffect, useState } from 'react';
import { ApiError, createCustomer, updateCustomer } from '@/lib/api';
import { Customer, CustomerFormInput, CustomerStatus } from '@/lib/types';

const EMPTY_FORM: CustomerFormInput = {
  firstName: '',
  lastName: '',
  email: '',
  phone: '',
  company: '',
  status: CustomerStatus.LEAD,
  addressLine1: '',
  addressLine2: '',
  city: '',
  province: '',
  postalCode: '',
  country: '',
  lifetimeValue: '',
  notes: '',
};

function toFormInput(customer: Customer): CustomerFormInput {
  return {
    firstName: customer.firstName,
    lastName: customer.lastName,
    email: customer.email,
    phone: customer.phone ?? '',
    company: customer.company ?? '',
    status: customer.status,
    addressLine1: customer.addressLine1 ?? '',
    addressLine2: customer.addressLine2 ?? '',
    city: customer.city ?? '',
    province: customer.province ?? '',
    postalCode: customer.postalCode ?? '',
    country: customer.country ?? '',
    lifetimeValue: customer.lifetimeValue,
    notes: customer.notes ?? '',
  };
}

interface CustomerFormModalProps {
  customer: Customer | null;
  onClose: () => void;
  onSaved: () => void;
}

export default function CustomerFormModal({ customer, onClose, onSaved }: CustomerFormModalProps) {
  const isEdit = customer !== null;
  const [form, setForm] = useState<CustomerFormInput>(customer ? toFormInput(customer) : EMPTY_FORM);
  const [errors, setErrors] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setForm(customer ? toFormInput(customer) : EMPTY_FORM);
    setErrors([]);
  }, [customer]);

  function update<K extends keyof CustomerFormInput>(key: K, value: CustomerFormInput[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setErrors([]);

    if (!form.firstName.trim() || !form.lastName.trim() || !form.email.trim()) {
      setErrors(['First name, last name, and email are required.']);
      return;
    }

    setSaving(true);
    try {
      if (isEdit) {
        await updateCustomer(customer.id, form);
      } else {
        await createCustomer(form);
      }
      onSaved();
    } catch (err) {
      if (err instanceof ApiError) {
        setErrors(err.details);
      } else {
        setErrors(['Something went wrong. Please try again.']);
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-lg bg-white p-6 shadow-xl dark:bg-zinc-900"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">{isEdit ? 'Edit customer' : 'Add customer'}</h2>
          <button
            type="button"
            onClick={onClose}
            className="text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        {errors.length > 0 && (
          <div className="mb-4 rounded border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-300">
            {errors.map((msg, i) => (
              <div key={i}>{msg}</div>
            ))}
          </div>
        )}

        <form onSubmit={handleSubmit} className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="First name *">
            <input
              className="input"
              value={form.firstName}
              onChange={(e) => update('firstName', e.target.value)}
              required
            />
          </Field>
          <Field label="Last name *">
            <input
              className="input"
              value={form.lastName}
              onChange={(e) => update('lastName', e.target.value)}
              required
            />
          </Field>
          <Field label="Email *">
            <input
              type="email"
              className="input"
              value={form.email}
              onChange={(e) => update('email', e.target.value)}
              required
            />
          </Field>
          <Field label="Phone">
            <input className="input" value={form.phone} onChange={(e) => update('phone', e.target.value)} />
          </Field>
          <Field label="Company">
            <input
              className="input"
              value={form.company}
              onChange={(e) => update('company', e.target.value)}
            />
          </Field>
          <Field label="Status">
            <select
              className="input"
              value={form.status}
              onChange={(e) => update('status', e.target.value as CustomerStatus)}
            >
              {Object.values(CustomerStatus).map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Address line 1">
            <input
              className="input"
              value={form.addressLine1}
              onChange={(e) => update('addressLine1', e.target.value)}
            />
          </Field>
          <Field label="Address line 2">
            <input
              className="input"
              value={form.addressLine2}
              onChange={(e) => update('addressLine2', e.target.value)}
            />
          </Field>
          <Field label="City">
            <input className="input" value={form.city} onChange={(e) => update('city', e.target.value)} />
          </Field>
          <Field label="Province">
            <input
              className="input"
              value={form.province}
              onChange={(e) => update('province', e.target.value)}
            />
          </Field>
          <Field label="Postal code">
            <input
              className="input"
              value={form.postalCode}
              onChange={(e) => update('postalCode', e.target.value)}
            />
          </Field>
          <Field label="Country">
            <input
              className="input"
              value={form.country}
              onChange={(e) => update('country', e.target.value)}
            />
          </Field>
          <Field label="Lifetime value">
            <input
              className="input"
              value={form.lifetimeValue}
              onChange={(e) => update('lifetimeValue', e.target.value)}
              placeholder="0.00"
            />
          </Field>
          <Field label="Notes" full>
            <textarea
              className="input"
              rows={3}
              value={form.notes}
              onChange={(e) => update('notes', e.target.value)}
            />
          </Field>

          <div className="col-span-full mt-2 flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded border border-zinc-300 px-4 py-2 text-sm hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-800"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="rounded bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {saving ? 'Saving…' : isEdit ? 'Save changes' : 'Add customer'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function Field({ label, full, children }: { label: string; full?: boolean; children: React.ReactNode }) {
  return (
    <label className={`flex flex-col gap-1 text-sm ${full ? 'sm:col-span-2' : ''}`}>
      <span className="text-zinc-600 dark:text-zinc-400">{label}</span>
      {children}
    </label>
  );
}
