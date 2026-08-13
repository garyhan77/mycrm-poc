import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Customer, CustomerStatus } from './customer.entity';

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

  // Only set on DEACTIVATED events: the customer's status immediately
  // before it was forced to INACTIVE, so reactivation can restore it.
  @Column({ type: 'enum', enum: CustomerStatus, nullable: true })
  previousStatus: CustomerStatus | null;

  @CreateDateColumn()
  occurredAt: Date;
}
