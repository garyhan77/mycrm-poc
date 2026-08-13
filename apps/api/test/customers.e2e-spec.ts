// Must run before AppModule (and its ConfigModule.forRoot dotenv load) is
// imported below: dotenv does not overwrite variables already present in
// process.env, so setting this first redirects the whole app at crm_poc_test
// instead of the real crm_poc database.
process.env.DB_DATABASE = 'crm_poc_test';

import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { getDataSourceToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';

describe('Customers (e2e)', () => {
  let app: INestApplication<App>;
  let dataSource: DataSource;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api');
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: true }),
    );
    await app.init();

    dataSource = moduleFixture.get(getDataSourceToken());
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    // Same FK-checks-disabled reset the seed script uses: customer_activities
    // FKs to customers, and MySQL refuses TRUNCATE on a referenced table
    // regardless of whether the referencing table currently has rows.
    await dataSource.query('SET FOREIGN_KEY_CHECKS = 0');
    await dataSource.query('TRUNCATE TABLE customer_activities');
    await dataSource.query('TRUNCATE TABLE customers');
    await dataSource.query('SET FOREIGN_KEY_CHECKS = 1');
  });

  const server = () => app.getHttpServer();

  describe('full customer lifecycle', () => {
    it('creates, views, searches, edits, and deletes a customer', async () => {
      const createRes = await request(server())
        .post('/api/customers')
        .send({ firstName: 'Grace', lastName: 'Hopper', email: 'grace@example.com' })
        .expect(201);
      const id = createRes.body.id;
      expect(createRes.body.status).toBe('LEAD');

      await request(server())
        .get(`/api/customers/${id}`)
        .expect(200)
        .expect((res) => {
          expect(res.body.email).toBe('grace@example.com');
        });

      const searchRes = await request(server()).get('/api/customers?q=hopper').expect(200);
      expect(searchRes.body.total).toBe(1);
      expect(searchRes.body.data[0].id).toBe(id);

      await request(server())
        .patch(`/api/customers/${id}`)
        .send({ status: 'ACTIVE' })
        .expect(200)
        .expect((res) => {
          expect(res.body.status).toBe('ACTIVE');
          expect(res.body.email).toBe('grace@example.com');
        });

      await request(server()).delete(`/api/customers/${id}`).expect(204);

      await request(server()).get(`/api/customers/${id}`).expect(404);
      const afterDeleteSearch = await request(server()).get('/api/customers?q=hopper').expect(200);
      expect(afterDeleteSearch.body.total).toBe(0);
    });
  });

  describe('validation and conflicts', () => {
    it('rejects an invalid payload with 400', async () => {
      await request(server()).post('/api/customers').send({ firstName: 'NoEmail' }).expect(400);
    });

    it('rejects a duplicate email (active customer) with 409', async () => {
      await request(server())
        .post('/api/customers')
        .send({ firstName: 'A', lastName: 'B', email: 'dup@example.com' })
        .expect(201);

      await request(server())
        .post('/api/customers')
        .send({ firstName: 'C', lastName: 'D', email: 'dup@example.com' })
        .expect(409);
    });

    it('returns 404 for an unknown id on view, edit, and delete', async () => {
      await request(server()).get('/api/customers/999999').expect(404);
      await request(server()).patch('/api/customers/999999').send({ firstName: 'X' }).expect(404);
      await request(server()).delete('/api/customers/999999').expect(404);
    });
  });

  describe('bulk delete', () => {
    it('soft-deletes multiple customers at once, leaving the rest untouched', async () => {
      const a = (
        await request(server())
          .post('/api/customers')
          .send({ firstName: 'A', lastName: 'One', email: 'a1@example.com' })
      ).body;
      const b = (
        await request(server())
          .post('/api/customers')
          .send({ firstName: 'B', lastName: 'Two', email: 'b2@example.com' })
      ).body;
      const c = (
        await request(server())
          .post('/api/customers')
          .send({ firstName: 'C', lastName: 'Three', email: 'c3@example.com' })
      ).body;

      await request(server())
        .delete('/api/customers')
        .send({ ids: [a.id, b.id] })
        .expect(204);

      const listRes = await request(server()).get('/api/customers').expect(200);
      const remainingIds = listRes.body.data.map((customer: { id: number }) => customer.id);
      expect(remainingIds).toContain(c.id);
      expect(remainingIds).not.toContain(a.id);
      expect(remainingIds).not.toContain(b.id);
    });

    it('rejects an empty ids array with 400', async () => {
      await request(server()).delete('/api/customers').send({ ids: [] }).expect(400);
    });
  });

  describe('reactivation and activity audit trail', () => {
    it('logs CREATED, then DEACTIVATED, then REACTIVATED while preserving fields left blank on re-add', async () => {
      const createRes = await request(server())
        .post('/api/customers')
        .send({
          firstName: 'Original',
          lastName: 'Person',
          email: 'cycle@example.com',
          company: 'Keep Co',
          notes: 'Keep these notes',
        })
        .expect(201);
      const id = createRes.body.id;

      let activityRes = await request(server()).get(`/api/customers/${id}/activity`).expect(200);
      expect(activityRes.body.map((a: { type: string }) => a.type)).toEqual(['CREATED']);

      await request(server()).delete(`/api/customers/${id}`).expect(204);

      activityRes = await request(server()).get(`/api/customers/${id}/activity`).expect(200);
      expect(activityRes.body.map((a: { type: string }) => a.type)).toEqual([
        'CREATED',
        'DEACTIVATED',
      ]);

      const reactivateRes = await request(server())
        .post('/api/customers')
        .send({ firstName: 'Reactivated', lastName: 'Person', email: 'cycle@example.com' })
        .expect(201);

      expect(reactivateRes.body.id).toBe(id);
      expect(reactivateRes.body.firstName).toBe('Reactivated');
      expect(reactivateRes.body.company).toBe('Keep Co');
      expect(reactivateRes.body.notes).toBe('Keep these notes');
      expect(reactivateRes.body.deletedAt).toBeNull();
      expect(reactivateRes.body.status).toBe('LEAD'); // restored default, none was set before delete

      activityRes = await request(server()).get(`/api/customers/${id}/activity`).expect(200);
      expect(activityRes.body.map((a: { type: string }) => a.type)).toEqual([
        'CREATED',
        'DEACTIVATED',
        'REACTIVATED',
      ]);

      const searchRes = await request(server()).get('/api/customers?q=cycle').expect(200);
      expect(searchRes.body.total).toBe(1);
    });

    it('forces status to INACTIVE on delete, records the prior status, and restores it on reactivation', async () => {
      const createRes = await request(server())
        .post('/api/customers')
        .send({ firstName: 'Status', lastName: 'Cycle', email: 'status-cycle@example.com' })
        .expect(201);
      const id = createRes.body.id;

      await request(server())
        .patch(`/api/customers/${id}`)
        .send({ status: 'ACTIVE' })
        .expect(200);

      await request(server()).delete(`/api/customers/${id}`).expect(204);

      const activityAfterDelete = await request(server())
        .get(`/api/customers/${id}/activity`)
        .expect(200);
      const deactivatedEvent = activityAfterDelete.body.find(
        (a: { type: string }) => a.type === 'DEACTIVATED',
      );
      expect(deactivatedEvent.previousStatus).toBe('ACTIVE');

      const reactivateRes = await request(server())
        .post('/api/customers')
        .send({ firstName: 'Status', lastName: 'Cycle', email: 'status-cycle@example.com' })
        .expect(201);
      expect(reactivateRes.body.status).toBe('ACTIVE');
    });

    it('lets an explicitly submitted status on re-add override the restored one', async () => {
      const createRes = await request(server())
        .post('/api/customers')
        .send({
          firstName: 'Override',
          lastName: 'Status',
          email: 'override-status@example.com',
          status: 'ACTIVE',
        })
        .expect(201);
      const id = createRes.body.id;

      await request(server()).delete(`/api/customers/${id}`).expect(204);

      const reactivateRes = await request(server())
        .post('/api/customers')
        .send({
          firstName: 'Override',
          lastName: 'Status',
          email: 'override-status@example.com',
          status: 'INACTIVE',
        })
        .expect(201);
      expect(reactivateRes.body.status).toBe('INACTIVE');
    });

    it('still blocks a true duplicate email that belongs to an active customer with 409', async () => {
      await request(server())
        .post('/api/customers')
        .send({ firstName: 'Active', lastName: 'One', email: 'active@example.com' })
        .expect(201);

      await request(server())
        .post('/api/customers')
        .send({ firstName: 'Another', lastName: 'Two', email: 'active@example.com' })
        .expect(409);
    });

    it('returns 404 for activity on a customer id that never existed', async () => {
      await request(server()).get('/api/customers/999999/activity').expect(404);
    });
  });
});
