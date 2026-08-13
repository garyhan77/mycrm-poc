import 'dotenv/config';
import dataSource from './data-source';
import { Customer, CustomerStatus } from './customers/customer.entity';
import { CustomerActivity, CustomerActivityType } from './customers/customer-activity.entity';

const firstNames = [
  'Ava', 'Liam', 'Sophia', 'Noah', 'Isabella', 'Ethan', 'Mia', 'Lucas',
  'Amelia', 'Mason', 'Harper', 'Logan', 'Evelyn', 'James', 'Abigail',
  'Benjamin', 'Emily', 'Elijah', 'Charlotte', 'Oliver', 'Grace', 'Jacob',
  'Chloe', 'Michael', 'Zoey', 'Alexander', 'Lily', 'Daniel', 'Hannah', 'Henry',
];
const lastNames = [
  'Nguyen', 'Smith', 'Patel', 'Kim', 'Garcia', 'Chen', 'Brown', 'Singh',
  'Martin', 'Lee', 'Wilson', 'Tran', 'Anderson', 'Taylor', 'Wong', 'Moore',
  'Jackson', 'Martinez', 'Clark', 'Roy', 'Lewis', 'Walker', 'Young', 'Hall',
  'Allen', 'King', 'Wright', 'Scott', 'Green', 'Baker',
];
const companies = [
  'Northwind Traders', 'Bluepeak Retail', 'Cartline', 'Fresh Fold Apparel',
  'Loop Electronics', 'Marlowe Goods', 'Pixel & Twine', 'Riverside Supply',
  null, null,
];
const statuses = [CustomerStatus.LEAD, CustomerStatus.ACTIVE, CustomerStatus.INACTIVE];
const cities = ['Toronto', 'Vancouver', 'Calgary', 'Ottawa', 'Montreal', 'London'];
const provinces = ['ON', 'BC', 'AB', 'ON', 'QC', 'ON'];

async function seed() {
  await dataSource.initialize();
  const customerRepo = dataSource.getRepository(Customer);
  const activityRepo = dataSource.getRepository(CustomerActivity);

  // MySQL refuses to TRUNCATE a table referenced by an FK constraint at all
  // (regardless of whether the referencing table currently has rows), so the
  // constraint check is disabled for the duration of the reset.
  await dataSource.query('SET FOREIGN_KEY_CHECKS = 0');
  await dataSource.query('TRUNCATE TABLE customer_activities');
  await dataSource.query('TRUNCATE TABLE customers');
  await dataSource.query('SET FOREIGN_KEY_CHECKS = 1');

  const customers: Partial<Customer>[] = firstNames.map((firstName, i) => {
    const lastName = lastNames[i];
    const cityIndex = i % cities.length;
    return {
      firstName,
      lastName,
      email: `${firstName.toLowerCase()}.${lastName.toLowerCase()}@example.com`,
      phone: `416-555-${String(1000 + i).slice(-4)}`,
      company: companies[i % companies.length] ?? undefined,
      status: statuses[i % statuses.length],
      addressLine1: `${100 + i} Main St`,
      city: cities[cityIndex],
      province: provinces[cityIndex],
      postalCode: 'M4B 1B3',
      country: 'Canada',
      totalOrders: (i * 3) % 15,
      lifetimeValue: (((i * 37) % 900) + 20).toFixed(2),
      notes: i % 5 === 0 ? 'Signed up via holiday promo.' : undefined,
    };
  });

  const saved = await customerRepo.save(customers);
  const activities = saved.map((customer) =>
    activityRepo.create({ customerId: customer.id, type: CustomerActivityType.CREATED }),
  );
  await activityRepo.save(activities);

  console.log(`Seeded ${saved.length} customers with CREATED activity records.`);
  await dataSource.destroy();
}

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});
