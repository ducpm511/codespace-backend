import { MigrationInterface, QueryRunner } from "typeorm";

export class  $npmConfigName1761156232865 implements MigrationInterface {
    name = ' $npmConfigName1761156232865'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "ot_requests" ADD CONSTRAINT "UQ_733acfa8bcb60e99b98dcb0c58b" UNIQUE ("staffId", "date")`);
        await queryRunner.query(`ALTER TABLE "staff_schedules" ADD CONSTRAINT "FK_c8e43a8e65c108398918a0b0431" FOREIGN KEY ("roleKey") REFERENCES "roles"("key") ON DELETE SET NULL ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "staff_schedules" DROP CONSTRAINT "FK_c8e43a8e65c108398918a0b0431"`);
        await queryRunner.query(`ALTER TABLE "ot_requests" DROP CONSTRAINT "UQ_733acfa8bcb60e99b98dcb0c58b"`);
    }

}
