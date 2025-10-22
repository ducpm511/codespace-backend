import { MigrationInterface, QueryRunner } from 'typeorm';

export class $npmConfigName1760514696759 implements MigrationInterface {
  name = ' $npmConfigName1760514696759';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "staff_attendances" ("id" SERIAL NOT NULL, "staffId" integer NOT NULL, "date" date NOT NULL, "checkInTime" TIMESTAMP WITH TIME ZONE NOT NULL, "checkOutTime" TIMESTAMP WITH TIME ZONE, CONSTRAINT "PK_8f9acf4fc3f3118ec671cba1d65" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "shift" ("id" SERIAL NOT NULL, "name" character varying NOT NULL, "startTime" TIME NOT NULL, "endTime" TIME NOT NULL, "breakDuration" interval NOT NULL DEFAULT '00:00:00', "otMultiplier" numeric(3,2) NOT NULL DEFAULT '1', CONSTRAINT "UQ_d336a07a501e3a71abb7b695132" UNIQUE ("name"), CONSTRAINT "PK_53071a6485a1e9dc75ec3db54b9" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "staff_schedules" ("id" SERIAL NOT NULL, "date" date NOT NULL, "staffId" integer NOT NULL, "shiftId" integer, "classSessionId" integer, CONSTRAINT "PK_6484157e0a3264994b8572183ef" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."ot_requests_status_enum" AS ENUM('pending', 'approved', 'rejected')`,
    );
    await queryRunner.query(
      `CREATE TABLE "ot_requests" ("id" SERIAL NOT NULL, "staffId" integer NOT NULL, "date" date NOT NULL, "detectedDuration" interval NOT NULL, "approvedDuration" interval, "reason" text, "notes" text, "status" "public"."ot_requests_status_enum" NOT NULL DEFAULT 'pending', "approverId" integer, CONSTRAINT "PK_688842e471497270f16ca88c814" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(`ALTER TABLE "staffs" ADD "rates" jsonb`);
    await queryRunner.query(
      `COMMENT ON COLUMN "staffs"."rates" IS 'Lưu các mức thù lao theo vai trò, ví dụ: {"part-time": 40000, "teacher": 100000}'`,
    );
    await queryRunner.query(
      `ALTER TABLE "staff_attendances" ADD CONSTRAINT "FK_89997a4eef34545a7661513a37c" FOREIGN KEY ("staffId") REFERENCES "staffs"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "staff_schedules" ADD CONSTRAINT "FK_0fd8c4a28dbb3eb655071efd06d" FOREIGN KEY ("staffId") REFERENCES "staffs"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "staff_schedules" ADD CONSTRAINT "FK_e5127408e8af62c69b1a98a9a83" FOREIGN KEY ("shiftId") REFERENCES "shift"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "staff_schedules" ADD CONSTRAINT "FK_aae3a934db42d1f3d5d4b7765ea" FOREIGN KEY ("classSessionId") REFERENCES "class_sessions"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "ot_requests" ADD CONSTRAINT "FK_fcd8da906a20111c9aadb993ce2" FOREIGN KEY ("staffId") REFERENCES "staffs"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "ot_requests" ADD CONSTRAINT "FK_6c4c40e06e5284b2658d6e2ff91" FOREIGN KEY ("approverId") REFERENCES "staffs"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "ot_requests" DROP CONSTRAINT "FK_6c4c40e06e5284b2658d6e2ff91"`,
    );
    await queryRunner.query(
      `ALTER TABLE "ot_requests" DROP CONSTRAINT "FK_fcd8da906a20111c9aadb993ce2"`,
    );
    await queryRunner.query(
      `ALTER TABLE "staff_schedules" DROP CONSTRAINT "FK_aae3a934db42d1f3d5d4b7765ea"`,
    );
    await queryRunner.query(
      `ALTER TABLE "staff_schedules" DROP CONSTRAINT "FK_e5127408e8af62c69b1a98a9a83"`,
    );
    await queryRunner.query(
      `ALTER TABLE "staff_schedules" DROP CONSTRAINT "FK_0fd8c4a28dbb3eb655071efd06d"`,
    );
    await queryRunner.query(
      `ALTER TABLE "staff_attendances" DROP CONSTRAINT "FK_89997a4eef34545a7661513a37c"`,
    );
    await queryRunner.query(
      `COMMENT ON COLUMN "staffs"."rates" IS 'Lưu các mức thù lao theo vai trò, ví dụ: {"part-time": 40000, "teacher": 100000}'`,
    );
    await queryRunner.query(`ALTER TABLE "staffs" DROP COLUMN "rates"`);
    await queryRunner.query(`DROP TABLE "ot_requests"`);
    await queryRunner.query(`DROP TYPE "public"."ot_requests_status_enum"`);
    await queryRunner.query(`DROP TABLE "staff_schedules"`);
    await queryRunner.query(`DROP TABLE "shift"`);
    await queryRunner.query(`DROP TABLE "staff_attendances"`);
  }
}
