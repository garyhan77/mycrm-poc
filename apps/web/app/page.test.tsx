import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Home from './page';
import { Customer, CustomerStatus } from '@/lib/types';

jest.mock('@/lib/api', () => {
  const actual = jest.requireActual('@/lib/api');
  return {
    ...actual,
    listCustomers: jest.fn(),
    bulkDeleteCustomers: jest.fn(),
    createCustomer: jest.fn(),
    updateCustomer: jest.fn(),
  };
});

import { listCustomers } from '@/lib/api';

const mockListCustomers = listCustomers as jest.Mock;

const customer: Customer = {
  id: 1,
  firstName: 'Ada',
  lastName: 'Lovelace',
  email: 'ada@example.com',
  phone: null,
  company: null,
  status: CustomerStatus.LEAD,
  addressLine1: null,
  addressLine2: null,
  city: null,
  province: null,
  postalCode: null,
  country: null,
  totalOrders: 0,
  lifetimeValue: '0.00',
  notes: null,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

describe('Home (landing page)', () => {
  beforeEach(() => {
    mockListCustomers.mockReset();
    mockListCustomers.mockResolvedValue({ data: [customer], total: 1, page: 1, limit: 10 });
  });

  it('shows the MyCRM header and loads customers on mount with default params', async () => {
    render(<Home />);

    expect(screen.getByRole('heading', { name: 'MyCRM' })).toBeInTheDocument();

    await waitFor(() =>
      expect(mockListCustomers).toHaveBeenCalledWith(
        expect.objectContaining({
          q: undefined,
          page: 1,
          limit: 10,
          sortBy: 'createdAt',
          sortOrder: 'DESC',
        }),
      ),
    );
    expect(await screen.findByText('Ada')).toBeInTheDocument();
  });

  it('searches by query text and resets to page 1 when the Search button is clicked', async () => {
    const user = userEvent.setup();
    render(<Home />);

    await screen.findByText('Ada');
    mockListCustomers.mockClear();

    await user.type(screen.getByPlaceholderText(/Search by name/i), 'lovelace');
    await user.click(screen.getByRole('button', { name: 'Search' }));

    await waitFor(() =>
      expect(mockListCustomers).toHaveBeenCalledWith(
        expect.objectContaining({ q: 'lovelace', page: 1 }),
      ),
    );
  });

  it('opens the Add customer modal when the Add button is clicked', async () => {
    const user = userEvent.setup();
    render(<Home />);

    await screen.findByText('Ada');
    await user.click(screen.getByRole('button', { name: 'Add customer' }));

    expect(screen.getByRole('heading', { name: 'Add customer' })).toBeInTheDocument();
  });
});
