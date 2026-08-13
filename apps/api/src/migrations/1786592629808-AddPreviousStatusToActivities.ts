import { MigrationInterface, QueryRunner } from "typeorm";

export class AddPreviousStatusToActivities1786592629808 implements MigrationInterface {
    name = 'AddPreviousStatusToActivities1786592629808'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE \`customer_activities\` ADD \`previousStatus\` enum ('LEAD', 'ACTIVE', 'INACTIVE') NULL`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE \`customer_activities\` DROP COLUMN \`previousStatus\``);
    }

}
