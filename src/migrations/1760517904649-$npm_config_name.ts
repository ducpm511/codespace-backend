import { MigrationInterface, QueryRunner } from 'typeorm';

export class $npmConfigName1760517904649 implements MigrationInterface {
  name = ' $npmConfigName1760517904649';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "staff_attendances" DROP COLUMN "date"`,
    );
    await queryRunner.query(
      `ALTER TABLE "staff_attendances" DROP COLUMN "checkInTime"`,
    );
    await queryRunner.query(
      `ALTER TABLE "staff_attendances" DROP COLUMN "checkOutTime"`,
    );
    await queryRunner.query(
      `ALTER TABLE "staff_attendances" ADD "timestamp" TIMESTAMP WITH TIME ZONE NOT NULL`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."staff_attendances_type_enum" AS ENUM('check-in', 'check-out')`,
    );
    await queryRunner.query(
      `ALTER TABLE "staff_attendances" ADD "type" "public"."staff_attendances_type_enum" NOT NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "staff_attendances" DROP COLUMN "type"`,
    );
    await queryRunner.query(`DROP TYPE "public"."staff_attendances_type_enum"`);
    await queryRunner.query(
      `ALTER TABLE "staff_attendances" DROP COLUMN "timestamp"`,
    );
    await queryRunner.query(
      `ALTER TABLE "staff_attendances" ADD "checkOutTime" TIMESTAMP WITH TIME ZONE`,
    );
    await queryRunner.query(
      `ALTER TABLE "staff_attendances" ADD "checkInTime" TIMESTAMP WITH TIME ZONE NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "staff_attendances" ADD "date" date NOT NULL`,
    );
  }
}
