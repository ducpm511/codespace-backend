import { MigrationInterface, QueryRunner } from "typeorm";

export class AddRateInfoToOtRequest1763365489284 implements MigrationInterface {
    name = 'AddRateInfoToOtRequest1763365489284'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "ot_requests" ADD "approvedRoleKey" character varying`);
        await queryRunner.query(`ALTER TABLE "ot_requests" ADD "approvedMultiplier" numeric(3,2)`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "ot_requests" DROP COLUMN "approvedMultiplier"`);
        await queryRunner.query(`ALTER TABLE "ot_requests" DROP COLUMN "approvedRoleKey"`);
    }

}
