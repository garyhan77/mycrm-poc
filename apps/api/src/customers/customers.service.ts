import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { Customer } from './customer.entity';
import { CustomerActivity, CustomerActivityType } from './customer-activity.entity';
import { CreateCustomerDto } from './dto/create-customer.dto';
import { UpdateCustomerDto } from './dto/update-customer.dto';
import { QueryCustomersDto } from './dto/query-customers.dto';

export interface PaginatedCustomers {
  data: Customer[];
  total: number;
  page: number;
  limit: number;
}

@Injectable()
export class CustomersService {
  constructor(
    @InjectRepository(Customer)
    private readonly customersRepository: Repository<Customer>,
    @InjectRepository(CustomerActivity)
    private readonly activityRepository: Repository<CustomerActivity>,
  ) {}

  async create(dto: CreateCustomerDto): Promise<Customer> {
    // withDeleted: the unique index on email still counts soft-deleted rows,
    // so a previously-deleted customer's email is also "taken" at the DB level.
    const existing = await this.customersRepository.findOne({
      where: { email: dto.email },
      withDeleted: true,
    });

    if (existing && !existing.deletedAt) {
      throw new ConflictException(`A customer with email ${dto.email} already exists`);
    }

    if (existing && existing.deletedAt) {
      // Re-adding a previously-deleted customer's email reactivates that record
      // instead of creating a new one, so order/address/notes history isn't lost.
      // Fields left blank on the Add form simply keep their prior values.
      //
      // CreateCustomerDto's optional fields compile (useDefineForClassFields,
      // implied by this project's ES2023 target) to real own properties
      // initialized to `undefined` rather than being genuinely absent, so a
      // plain Object.assign(existing, dto) would overwrite every field the
      // client left blank with undefined. Only merge fields actually present.
      const submittedFields = Object.fromEntries(
        Object.entries(dto).filter(([, value]) => value !== undefined),
      );
      Object.assign(existing, submittedFields);
      existing.deletedAt = null;
      const reactivated = await this.customersRepository.save(existing);
      await this.logActivity(reactivated.id, CustomerActivityType.REACTIVATED);
      return reactivated;
    }

    const customer = this.customersRepository.create(dto);
    const created = await this.customersRepository.save(customer);
    await this.logActivity(created.id, CustomerActivityType.CREATED);
    return created;
  }

  async findAll(query: QueryCustomersDto): Promise<PaginatedCustomers> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const sortBy = query.sortBy ?? 'createdAt';
    const sortOrder = query.sortOrder ?? 'DESC';

    const qb = this.customersRepository.createQueryBuilder('customer');

    if (query.q) {
      qb.andWhere(
        '(customer.firstName LIKE :q OR customer.lastName LIKE :q OR customer.email LIKE :q OR customer.company LIKE :q)',
        { q: `%${query.q}%` },
      );
    }

    if (query.status) {
      qb.andWhere('customer.status = :status', { status: query.status });
    }

    qb.orderBy(`customer.${sortBy}`, sortOrder)
      .skip((page - 1) * limit)
      .take(limit);

    const [data, total] = await qb.getManyAndCount();
    return { data, total, page, limit };
  }

  async findOne(id: number): Promise<Customer> {
    const customer = await this.customersRepository.findOne({ where: { id } });
    if (!customer) {
      throw new NotFoundException(`Customer ${id} not found`);
    }
    return customer;
  }

  async update(id: number, dto: UpdateCustomerDto): Promise<Customer> {
    const customer = await this.findOne(id);
    if (dto.email && dto.email !== customer.email) {
      await this.assertEmailIsAvailable(dto.email);
    }
    Object.assign(customer, dto);
    return this.customersRepository.save(customer);
  }

  async remove(id: number): Promise<void> {
    const customer = await this.findOne(id);
    await this.customersRepository.softRemove(customer);
    await this.logActivity(id, CustomerActivityType.DEACTIVATED);
  }

  async removeMany(ids: number[]): Promise<void> {
    const customers = await this.customersRepository.findBy({ id: In(ids) });
    await this.customersRepository.softRemove(customers);
    await Promise.all(
      customers.map((customer) => this.logActivity(customer.id, CustomerActivityType.DEACTIVATED)),
    );
  }

  async getActivity(id: number): Promise<CustomerActivity[]> {
    const customer = await this.customersRepository.findOne({
      where: { id },
      withDeleted: true,
    });
    if (!customer) {
      throw new NotFoundException(`Customer ${id} not found`);
    }
    return this.activityRepository.find({
      where: { customerId: id },
      order: { occurredAt: 'ASC' },
    });
  }

  private async assertEmailIsAvailable(email: string): Promise<void> {
    const existing = await this.customersRepository.findOne({
      where: { email },
      withDeleted: true,
    });
    if (existing) {
      throw new ConflictException(`A customer with email ${email} already exists`);
    }
  }

  private async logActivity(customerId: number, type: CustomerActivityType): Promise<void> {
    const activity = this.activityRepository.create({ customerId, type });
    await this.activityRepository.save(activity);
  }
}
