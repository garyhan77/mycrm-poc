import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Customer } from './customer.entity';
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
  ) {}

  async create(dto: CreateCustomerDto): Promise<Customer> {
    await this.assertEmailIsAvailable(dto.email);
    const customer = this.customersRepository.create(dto);
    return this.customersRepository.save(customer);
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
  }

  private async assertEmailIsAvailable(email: string): Promise<void> {
    const existing = await this.customersRepository.findOne({ where: { email } });
    if (existing) {
      throw new ConflictException(`A customer with email ${email} already exists`);
    }
  }
}
