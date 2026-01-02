import { MigrationInterface, QueryRunner } from "typeorm";

export class AddBreakdownColumn1767370700923 implements MigrationInterface {
    name = 'AddBreakdownColumn1767370700923'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "ot_requests" ADD "breakdown" json`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "ot_requests" DROP COLUMN "breakdown"`);
    }

}
