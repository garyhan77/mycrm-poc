import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import CustomerFormModal from './CustomerFormModal';
import { Customer, CustomerStatus } from '@/lib/types';

jest.mock('@/lib/api', () => {
  const actual = jest.requireActual('@/lib/api');
  return {
    ...actual,
    createCustomer: jest.fn(),
    updateCustomer: jest.fn(),
  };
});

import { ApiError, createCustomer, updateCustomer } from '@/lib/api';

const mockCreateCustomer = createCustomer as jest.Mock;
const mockUpdateCustomer = updateCustomer as jest.Mock;

const sampleCustomer: Customer = {
  id: 7,
  firstName: 'Ada',
  lastName: 'Lovelace',
  email: 'ada@example.com',
  phone: '555-0100',
  company: 'Analytical Engines',
  status: CustomerStatus.ACTIVE,
  addressLine1: null,
  addressLine2: null,
  city: null,
  province: null,
  postalCode: null,
  country: null,
  totalOrders: 3,
  lifetimeValue: '120.00',
  notes: null,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

describe('CustomerFormModal', () => {
  beforeEach(() => {
    mockCreateCustomer.mockReset();
    mockUpdateCustomer.mockReset();
  });

  it('renders an empty form in add mode', () => {
    render(<CustomerFormModal customer={null} onClose={jest.fn()} onSaved={jest.fn()} />);

    expect(screen.getByRole('heading', { name: 'Add customer' })).toBeInTheDocument();
    expect(screen.getByLabelText('First name *')).toHaveValue('');
    expect(screen.getByLabelText('Email *')).toHaveValue('');
  });

  it('pre-fills the form in edit mode', () => {
    render(<CustomerFormModal customer={sampleCustomer} onClose={jest.fn()} onSaved={jest.fn()} />);

    expect(screen.getByRole('heading', { name: 'Edit customer' })).toBeInTheDocument();
    expect(screen.getByLabelText('First name *')).toHaveValue('Ada');
    expect(screen.getByLabelText('Email *')).toHaveValue('ada@example.com');
    expect(screen.getByLabelText('Company')).toHaveValue('Analytical Engines');
  });

  it('blocks submission and shows an error when required fields are blank', async () => {
    const user = userEvent.setup();
    render(<CustomerFormModal customer={null} onClose={jest.fn()} onSaved={jest.fn()} />);

    await user.click(screen.getByRole('button', { name: 'Add customer' }));

    expect(
      screen.getByText('First name, last name, and email are required.'),
    ).toBeInTheDocument();
    expect(mockCreateCustomer).not.toHaveBeenCalled();
  });

  it('submits the filled-in form and calls onSaved on success', async () => {
    const user = userEvent.setup();
    mockCreateCustomer.mockResolvedValue({ ...sampleCustomer, id: 99 });
    const onSaved = jest.fn();

    render(<CustomerFormModal customer={null} onClose={jest.fn()} onSaved={onSaved} />);

    await user.type(screen.getByLabelText('First name *'), 'Grace');
    await user.type(screen.getByLabelText('Last name *'), 'Hopper');
    await user.type(screen.getByLabelText('Email *'), 'grace@example.com');
    await user.click(screen.getByRole('button', { name: 'Add customer' }));

    await waitFor(() => expect(onSaved).toHaveBeenCalled());
    expect(mockCreateCustomer).toHaveBeenCalledWith(
      expect.objectContaining({ firstName: 'Grace', lastName: 'Hopper', email: 'grace@example.com' }),
    );
  });

  it('edits an existing customer via updateCustomer, not createCustomer', async () => {
    const user = userEvent.setup();
    mockUpdateCustomer.mockResolvedValue(sampleCustomer);
    const onSaved = jest.fn();

    render(<CustomerFormModal customer={sampleCustomer} onClose={jest.fn()} onSaved={onSaved} />);

    await user.clear(screen.getByLabelText('Company'));
    await user.type(screen.getByLabelText('Company'), 'New Co');
    await user.click(screen.getByRole('button', { name: 'Save changes' }));

    await waitFor(() => expect(onSaved).toHaveBeenCalled());
    expect(mockUpdateCustomer).toHaveBeenCalledWith(
      7,
      expect.objectContaining({ company: 'New Co' }),
    );
    expect(mockCreateCustomer).not.toHaveBeenCalled();
  });

  it('shows the server error and does not close when the API rejects with a conflict', async () => {
    const user = userEvent.setup();
    mockCreateCustomer.mockRejectedValue(
      new ApiError(409, 'A customer with email grace@example.com already exists'),
    );
    const onSaved = jest.fn();

    render(<CustomerFormModal customer={null} onClose={jest.fn()} onSaved={onSaved} />);

    await user.type(screen.getByLabelText('First name *'), 'Grace');
    await user.type(screen.getByLabelText('Last name *'), 'Hopper');
    await user.type(screen.getByLabelText('Email *'), 'grace@example.com');
    await user.click(screen.getByRole('button', { name: 'Add customer' }));

    expect(
      await screen.findByText('A customer with email grace@example.com already exists'),
    ).toBeInTheDocument();
    expect(onSaved).not.toHaveBeenCalled();
  });

  it('calls onClose when Cancel is clicked', async () => {
    const user = userEvent.setup();
    const onClose = jest.fn();
    render(<CustomerFormModal customer={null} onClose={onClose} onSaved={jest.fn()} />);

    await user.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(onClose).toHaveBeenCalled();
  });
});
