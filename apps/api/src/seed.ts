import 'dotenv/config';
import dataSource from './data-source';
import { Customer, CustomerStatus } from './customers/customer.entity';

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
  const repo = dataSource.getRepository(Customer);

  await repo.clear().catch(() => undefined);

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

  await repo.save(customers);
  console.log(`Seeded ${customers.length} customers.`);
  await dataSource.destroy();
}

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});
