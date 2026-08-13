import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Customer } from './customer.entity';

export enum CustomerActivityType {
  CREATED = 'CREATED',
  DEACTIVATED = 'DEACTIVATED',
  REACTIVATED = 'REACTIVATED',
}

@Entity('customer_activities')
export class CustomerActivity {
  @PrimaryGeneratedColumn()
  id: number;

  @Index()
  @Column()
  customerId: number;

  @ManyToOne(() => Customer, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'customerId' })
  customer: Customer;

  @Column({ type: 'enum', enum: CustomerActivityType })
  type: CustomerActivityType;

  @CreateDateColumn()
  occurredAt: Date;
}
