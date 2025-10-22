import { MigrationInterface, QueryRunner } from 'typeorm';

export class $npmConfigName1761127642400 implements MigrationInterface {
  name = ' $npmConfigName1761127642400';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "roles" ("id" SERIAL NOT NULL, "name" character varying NOT NULL, "key" character varying NOT NULL, CONSTRAINT "UQ_648e3f5447f725579d7d4ffdfb7" UNIQUE ("name"), CONSTRAINT "UQ_a87cf0659c3ac379b339acf36a2" UNIQUE ("key"), CONSTRAINT "PK_c1433d71a4838793a49dcad46ab" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `ALTER TABLE "staff_schedules" ADD "roleKey" character varying`,
    );
    await queryRunner.query(
      `COMMENT ON COLUMN "staff_schedules"."roleKey" IS 'Key của vai trò (liên kết với RoleEntity.key)'`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `COMMENT ON COLUMN "staff_schedules"."roleKey" IS 'Key của vai trò (liên kết với RoleEntity.key)'`,
    );
    await queryRunner.query(
      `ALTER TABLE "staff_schedules" DROP COLUMN "roleKey"`,
    );
    await queryRunner.query(`DROP TABLE "roles"`);
  }
}
