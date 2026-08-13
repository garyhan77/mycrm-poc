import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import CustomerTable from './CustomerTable';
import { Customer, CustomerStatus } from '@/lib/types';

const customers: Customer[] = [
  {
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
  },
  {
    id: 2,
    firstName: 'Grace',
    lastName: 'Hopper',
    email: 'grace@example.com',
    phone: null,
    company: null,
    status: CustomerStatus.ACTIVE,
    addressLine1: null,
    addressLine2: null,
    city: null,
    province: null,
    postalCode: null,
    country: null,
    totalOrders: 5,
    lifetimeValue: '500.00',
    notes: null,
    createdAt: '2026-01-02T00:00:00.000Z',
    updatedAt: '2026-01-02T00:00:00.000Z',
  },
];

function renderTable(overrides: Partial<React.ComponentProps<typeof CustomerTable>> = {}) {
  const props: React.ComponentProps<typeof CustomerTable> = {
    customers,
    loading: false,
    sortBy: 'createdAt',
    sortOrder: 'DESC',
    onSortChange: jest.fn(),
    selectedIds: new Set<number>(),
    onToggleRow: jest.fn(),
    onToggleAll: jest.fn(),
    onEditCustomer: jest.fn(),
    ...overrides,
  };
  render(<CustomerTable {...props} />);
  return props;
}

describe('CustomerTable', () => {
  it('renders a row per customer with their data', () => {
    renderTable();

    expect(screen.getByText('Ada')).toBeInTheDocument();
    expect(screen.getByText('Lovelace')).toBeInTheDocument();
    expect(screen.getByText('grace@example.com')).toBeInTheDocument();
  });

  it('shows a loading state', () => {
    renderTable({ loading: true, customers: [] });
    expect(screen.getByText('Loading customers…')).toBeInTheDocument();
  });

  it('shows an empty state when there are no customers', () => {
    renderTable({ customers: [] });
    expect(screen.getByText('No customers found.')).toBeInTheDocument();
  });

  it('calls onSortChange with the column key when a header is clicked', async () => {
    const user = userEvent.setup();
    const props = renderTable();

    await user.click(screen.getByText('Last name'));

    expect(props.onSortChange).toHaveBeenCalledWith('lastName');
  });

  it('shows a sort direction arrow on the active sort column', () => {
    renderTable({ sortBy: 'lastName', sortOrder: 'ASC' });
    expect(screen.getByText('Last name ↑')).toBeInTheDocument();
  });

  it('calls onToggleAll when the header checkbox is clicked', async () => {
    const user = userEvent.setup();
    const props = renderTable();

    await user.click(screen.getByLabelText('Select all customers on this page'));

    expect(props.onToggleAll).toHaveBeenCalled();
  });

  it('calls onToggleRow with the customer id when a row checkbox is clicked', async () => {
    const user = userEvent.setup();
    const props = renderTable();

    await user.click(screen.getByLabelText('Select Grace Hopper'));

    expect(props.onToggleRow).toHaveBeenCalledWith(2);
  });

  it('calls onEditCustomer when a first name is clicked', async () => {
    const user = userEvent.setup();
    const props = renderTable();

    await user.click(screen.getByText('Ada'));

    expect(props.onEditCustomer).toHaveBeenCalledWith(customers[0]);
  });
});
