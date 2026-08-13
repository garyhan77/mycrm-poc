import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { In } from 'typeorm';
import { CustomersService } from './customers.service';
import { Customer, CustomerStatus } from './customer.entity';
import { CustomerActivity, CustomerActivityType } from './customer-activity.entity';

describe('CustomersService', () => {
  let service: CustomersService;
  let customerRepo: {
    findOne: jest.Mock;
    findBy: jest.Mock;
    create: jest.Mock;
    save: jest.Mock;
    softRemove: jest.Mock;
    createQueryBuilder: jest.Mock;
  };
  let activityRepo: {
    create: jest.Mock;
    save: jest.Mock;
    find: jest.Mock;
    findOne: jest.Mock;
  };
  let qb: {
    andWhere: jest.Mock;
    orderBy: jest.Mock;
    skip: jest.Mock;
    take: jest.Mock;
    getManyAndCount: jest.Mock;
  };

  beforeEach(async () => {
    qb = {
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      getManyAndCount: jest.fn(),
    };

    customerRepo = {
      findOne: jest.fn(),
      findBy: jest.fn(),
      create: jest.fn((dto) => ({ ...dto })),
      save: jest.fn(async (entity) => entity),
      softRemove: jest.fn(async (entities) => entities),
      createQueryBuilder: jest.fn(() => qb),
    };

    activityRepo = {
      create: jest.fn((data) => data),
      save: jest.fn(async (entity) => entity),
      find: jest.fn(),
      findOne: jest.fn().mockResolvedValue(null),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CustomersService,
        { provide: getRepositoryToken(Customer), useValue: customerRepo },
        { provide: getRepositoryToken(CustomerActivity), useValue: activityRepo },
      ],
    }).compile();

    service = module.get<CustomersService>(CustomersService);
  });

  describe('create', () => {
    it('creates a new customer and logs a CREATED activity when the email is unused', async () => {
      customerRepo.findOne.mockResolvedValue(null);
      customerRepo.save.mockImplementation(async (entity) => ({ ...entity, id: 42 }));
      const dto = { firstName: 'Ada', lastName: 'Lovelace', email: 'ada@example.com' };

      const result = await service.create(dto as any);

      expect(result.id).toBe(42);
      expect(customerRepo.create).toHaveBeenCalledWith(dto);
      expect(activityRepo.create).toHaveBeenCalledWith({
        customerId: 42,
        type: CustomerActivityType.CREATED,
        previousStatus: null,
      });
      expect(activityRepo.save).toHaveBeenCalled();
    });

    it('throws ConflictException when the email belongs to an active customer', async () => {
      customerRepo.findOne.mockResolvedValue({ id: 1, email: 'ada@example.com', deletedAt: null });

      await expect(
        service.create({ firstName: 'A', lastName: 'B', email: 'ada@example.com' } as any),
      ).rejects.toThrow(ConflictException);
      expect(customerRepo.save).not.toHaveBeenCalled();
      expect(activityRepo.create).not.toHaveBeenCalled();
    });

    it('reactivates a soft-deleted customer, merging only submitted fields and preserving the rest', async () => {
      const existing = {
        id: 5,
        firstName: 'Old',
        lastName: 'Name',
        email: 'reuse@example.com',
        company: 'Original Co',
        city: 'Toronto',
        notes: 'Original notes',
        status: CustomerStatus.INACTIVE, // forced by remove() at delete time
        deletedAt: new Date('2026-01-01'),
      };
      customerRepo.findOne.mockResolvedValue(existing);
      activityRepo.findOne.mockResolvedValue({
        type: CustomerActivityType.DEACTIVATED,
        previousStatus: CustomerStatus.LEAD,
      });

      const dto = { firstName: 'New', lastName: 'Name', email: 'reuse@example.com' };
      const result = await service.create(dto as any);

      expect(result.id).toBe(5);
      expect(result.deletedAt).toBeNull();
      expect(result.firstName).toBe('New');
      expect(result.company).toBe('Original Co');
      expect(result.city).toBe('Toronto');
      expect(result.notes).toBe('Original notes');
      expect(activityRepo.create).toHaveBeenCalledWith({
        customerId: 5,
        type: CustomerActivityType.REACTIVATED,
        previousStatus: null,
      });
    });

    it('restores the status the customer had before it was deleted', async () => {
      const existing = {
        id: 5,
        email: 'reuse@example.com',
        status: CustomerStatus.INACTIVE,
        deletedAt: new Date('2026-01-01'),
      };
      customerRepo.findOne.mockResolvedValue(existing);
      activityRepo.findOne.mockResolvedValue({
        type: CustomerActivityType.DEACTIVATED,
        previousStatus: CustomerStatus.ACTIVE,
      });

      const result = await service.create({
        firstName: 'New',
        lastName: 'Name',
        email: 'reuse@example.com',
      } as any);

      expect(activityRepo.findOne).toHaveBeenCalledWith({
        where: { customerId: 5, type: CustomerActivityType.DEACTIVATED },
        order: { occurredAt: 'DESC' },
      });
      expect(result.status).toBe(CustomerStatus.ACTIVE);
    });

    it('defaults to LEAD when reactivating a customer with no recorded prior status', async () => {
      const existing = {
        id: 5,
        email: 'reuse@example.com',
        status: CustomerStatus.INACTIVE,
        deletedAt: new Date('2026-01-01'),
      };
      customerRepo.findOne.mockResolvedValue(existing);
      activityRepo.findOne.mockResolvedValue(null);

      const result = await service.create({
        firstName: 'New',
        lastName: 'Name',
        email: 'reuse@example.com',
      } as any);

      expect(result.status).toBe(CustomerStatus.LEAD);
    });

    it('lets an explicitly submitted status override the restored one', async () => {
      const existing = {
        id: 5,
        email: 'reuse@example.com',
        status: CustomerStatus.INACTIVE,
        deletedAt: new Date('2026-01-01'),
      };
      customerRepo.findOne.mockResolvedValue(existing);
      activityRepo.findOne.mockResolvedValue({
        type: CustomerActivityType.DEACTIVATED,
        previousStatus: CustomerStatus.ACTIVE,
      });

      const result = await service.create({
        firstName: 'New',
        lastName: 'Name',
        email: 'reuse@example.com',
        status: CustomerStatus.LEAD,
      } as any);

      expect(activityRepo.findOne).not.toHaveBeenCalled();
      expect(result.status).toBe(CustomerStatus.LEAD);
    });
  });

  describe('findAll', () => {
    it('applies search, status filter, sorting, and pagination', async () => {
      qb.getManyAndCount.mockResolvedValue([[{ id: 1 }], 1]);

      const result = await service.findAll({
        q: 'ada',
        status: CustomerStatus.ACTIVE,
        page: 2,
        limit: 10,
        sortBy: 'lastName',
        sortOrder: 'ASC',
      } as any);

      expect(qb.andWhere).toHaveBeenCalledWith(expect.stringContaining('LIKE :q'), { q: '%ada%' });
      expect(qb.andWhere).toHaveBeenCalledWith('customer.status = :status', {
        status: CustomerStatus.ACTIVE,
      });
      expect(qb.orderBy).toHaveBeenCalledWith('customer.lastName', 'ASC');
      expect(qb.skip).toHaveBeenCalledWith(10);
      expect(qb.take).toHaveBeenCalledWith(10);
      expect(result).toEqual({ data: [{ id: 1 }], total: 1, page: 2, limit: 10 });
    });

    it('defaults to createdAt DESC with no filters when the query is empty', async () => {
      qb.getManyAndCount.mockResolvedValue([[], 0]);

      await service.findAll({} as any);

      expect(qb.andWhere).not.toHaveBeenCalled();
      expect(qb.orderBy).toHaveBeenCalledWith('customer.createdAt', 'DESC');
      expect(qb.skip).toHaveBeenCalledWith(0);
      expect(qb.take).toHaveBeenCalledWith(20);
    });
  });

  describe('findOne', () => {
    it('returns the customer when found', async () => {
      customerRepo.findOne.mockResolvedValue({ id: 1 });
      await expect(service.findOne(1)).resolves.toEqual({ id: 1 });
    });

    it('throws NotFoundException when the customer does not exist', async () => {
      customerRepo.findOne.mockResolvedValue(null);
      await expect(service.findOne(999)).rejects.toThrow(NotFoundException);
    });
  });

  describe('update', () => {
    it('merges dto fields onto the existing customer', async () => {
      customerRepo.findOne.mockResolvedValue({ id: 1, email: 'a@example.com', phone: '111' });

      const result = await service.update(1, { phone: '222' } as any);

      expect(result.phone).toBe('222');
      expect(customerRepo.save).toHaveBeenCalled();
    });

    it('does not re-check email availability when the email is unchanged', async () => {
      customerRepo.findOne.mockResolvedValue({ id: 1, email: 'a@example.com' });

      await service.update(1, { phone: '222' } as any);

      // Only the initial findOne(id) lookup, no extra call for an email check.
      expect(customerRepo.findOne).toHaveBeenCalledTimes(1);
    });

    it('throws ConflictException when changing to an email already in use', async () => {
      customerRepo.findOne
        .mockResolvedValueOnce({ id: 1, email: 'a@example.com' })
        .mockResolvedValueOnce({ id: 2, email: 'taken@example.com' });

      await expect(service.update(1, { email: 'taken@example.com' } as any)).rejects.toThrow(
        ConflictException,
      );
    });
  });

  describe('remove', () => {
    it('forces status to INACTIVE, soft-removes the customer, and logs the prior status', async () => {
      const customer = { id: 1, status: CustomerStatus.ACTIVE };
      customerRepo.findOne.mockResolvedValue(customer);

      await service.remove(1);

      expect(customer.status).toBe(CustomerStatus.INACTIVE);
      // softRemove() alone only persists the delete-date column in real
      // TypeORM -- the status change needs its own explicit save() call,
      // which a plain mock can't otherwise verify actually persists.
      expect(customerRepo.save).toHaveBeenCalledWith(customer);
      expect(customerRepo.softRemove).toHaveBeenCalledWith(customer);
      expect(activityRepo.create).toHaveBeenCalledWith({
        customerId: 1,
        type: CustomerActivityType.DEACTIVATED,
        previousStatus: CustomerStatus.ACTIVE,
      });
    });

    it('throws NotFoundException and does not soft-remove when the customer does not exist', async () => {
      customerRepo.findOne.mockResolvedValue(null);

      await expect(service.remove(999)).rejects.toThrow(NotFoundException);
      expect(customerRepo.softRemove).not.toHaveBeenCalled();
    });
  });

  describe('removeMany', () => {
    it('forces each status to INACTIVE, soft-removes them, and logs each prior status', async () => {
      const customers = [
        { id: 1, status: CustomerStatus.ACTIVE },
        { id: 2, status: CustomerStatus.LEAD },
      ];
      customerRepo.findBy.mockResolvedValue(customers);

      await service.removeMany([1, 2]);

      expect(customerRepo.findBy).toHaveBeenCalledWith({ id: In([1, 2]) });
      expect(customers[0].status).toBe(CustomerStatus.INACTIVE);
      expect(customers[1].status).toBe(CustomerStatus.INACTIVE);
      expect(customerRepo.save).toHaveBeenCalledWith(customers);
      expect(customerRepo.softRemove).toHaveBeenCalledWith(customers);
      expect(activityRepo.create).toHaveBeenCalledTimes(2);
      expect(activityRepo.create).toHaveBeenCalledWith({
        customerId: 1,
        type: CustomerActivityType.DEACTIVATED,
        previousStatus: CustomerStatus.ACTIVE,
      });
      expect(activityRepo.create).toHaveBeenCalledWith({
        customerId: 2,
        type: CustomerActivityType.DEACTIVATED,
        previousStatus: CustomerStatus.LEAD,
      });
    });

    it('does nothing when none of the ids match an existing customer', async () => {
      customerRepo.findBy.mockResolvedValue([]);

      await service.removeMany([999]);

      expect(customerRepo.softRemove).toHaveBeenCalledWith([]);
      expect(activityRepo.create).not.toHaveBeenCalled();
    });
  });

  describe('getActivity', () => {
    it('returns activity ordered chronologically, even for a soft-deleted customer', async () => {
      customerRepo.findOne.mockResolvedValue({ id: 1, deletedAt: new Date() });
      activityRepo.find.mockResolvedValue([{ type: CustomerActivityType.CREATED }]);

      const result = await service.getActivity(1);

      expect(customerRepo.findOne).toHaveBeenCalledWith({ where: { id: 1 }, withDeleted: true });
      expect(activityRepo.find).toHaveBeenCalledWith({
        where: { customerId: 1 },
        order: { occurredAt: 'ASC' },
      });
      expect(result).toEqual([{ type: CustomerActivityType.CREATED }]);
    });

    it('throws NotFoundException for a customer id that never existed', async () => {
      customerRepo.findOne.mockResolvedValue(null);
      await expect(service.getActivity(999)).rejects.toThrow(NotFoundException);
    });
  });
});
