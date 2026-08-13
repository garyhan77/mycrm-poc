import { MigrationInterface, QueryRunner } from "typeorm";

export class AddCustomerActivities1786585923652 implements MigrationInterface {
    name = 'AddCustomerActivities1786585923652'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE \`customer_activities\` (\`id\` int NOT NULL AUTO_INCREMENT, \`customerId\` int NOT NULL, \`type\` enum ('CREATED', 'DEACTIVATED', 'REACTIVATED') NOT NULL, \`occurredAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), INDEX \`IDX_f28a98d65acca98259cb985752\` (\`customerId\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`);
        await queryRunner.query(`ALTER TABLE \`customer_activities\` ADD CONSTRAINT \`FK_f28a98d65acca98259cb985752d\` FOREIGN KEY (\`customerId\`) REFERENCES \`customers\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE \`customer_activities\` DROP FOREIGN KEY \`FK_f28a98d65acca98259cb985752d\``);
        await queryRunner.query(`DROP INDEX \`IDX_f28a98d65acca98259cb985752\` ON \`customer_activities\``);
        await queryRunner.query(`DROP TABLE \`customer_activities\``);
    }

}
