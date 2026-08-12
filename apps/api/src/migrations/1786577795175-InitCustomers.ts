import { MigrationInterface, QueryRunner } from "typeorm";

export class InitCustomers1786577795175 implements MigrationInterface {
    name = 'InitCustomers1786577795175'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE \`customers\` (\`id\` int NOT NULL AUTO_INCREMENT, \`firstName\` varchar(100) NOT NULL, \`lastName\` varchar(100) NOT NULL, \`email\` varchar(255) NOT NULL, \`phone\` varchar(30) NULL, \`company\` varchar(150) NULL, \`status\` enum ('LEAD', 'ACTIVE', 'INACTIVE') NOT NULL DEFAULT 'LEAD', \`addressLine1\` varchar(255) NULL, \`addressLine2\` varchar(255) NULL, \`city\` varchar(100) NULL, \`province\` varchar(100) NULL, \`postalCode\` varchar(20) NULL, \`country\` varchar(100) NULL, \`totalOrders\` int NOT NULL DEFAULT '0', \`lifetimeValue\` decimal(10,2) NOT NULL DEFAULT '0.00', \`notes\` text NULL, \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updatedAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), \`deletedAt\` datetime(6) NULL, INDEX \`IDX_d4a7694ae97c32d3d286771229\` (\`firstName\`), INDEX \`IDX_8e11140e3639e6d35a9f79f980\` (\`lastName\`), UNIQUE INDEX \`IDX_8536b8b85c06969f84f0c098b0\` (\`email\`), INDEX \`IDX_589e5e6434f0e8628aa2ad33e1\` (\`status\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX \`IDX_589e5e6434f0e8628aa2ad33e1\` ON \`customers\``);
        await queryRunner.query(`DROP INDEX \`IDX_8536b8b85c06969f84f0c098b0\` ON \`customers\``);
        await queryRunner.query(`DROP INDEX \`IDX_8e11140e3639e6d35a9f79f980\` ON \`customers\``);
        await queryRunner.query(`DROP INDEX \`IDX_d4a7694ae97c32d3d286771229\` ON \`customers\``);
        await queryRunner.query(`DROP TABLE \`customers\``);
    }

}
