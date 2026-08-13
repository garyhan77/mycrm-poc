import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Customer } from './customer.entity';
import { CustomerActivity } from './customer-activity.entity';
import { CustomersController } from './customers.controller';
import { CustomersService } from './customers.service';

@Module({
  imports: [TypeOrmModule.forFeature([Customer, CustomerActivity])],
  controllers: [CustomersController],
  providers: [CustomersService],
})
export class CustomersModule {}
