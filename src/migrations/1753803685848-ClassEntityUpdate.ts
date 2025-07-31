import { MigrationInterface, QueryRunner } from 'typeorm';

export class ClassEntityUpdate1753803685848 implements MigrationInterface {
  name = 'ClassEntityUpdate1753803685848';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "classes" DROP COLUMN "scheduleDays"`);
    await queryRunner.query(`ALTER TABLE "classes" DROP COLUMN "scheduleTime"`);
    await queryRunner.query(`ALTER TABLE "classes" ADD "schedule" jsonb`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "classes" DROP COLUMN "schedule"`);
    await queryRunner.query(`ALTER TABLE "classes" ADD "scheduleTime" TIME`);
    await queryRunner.query(`ALTER TABLE "classes" ADD "scheduleDays" jsonb`);
  }
}
