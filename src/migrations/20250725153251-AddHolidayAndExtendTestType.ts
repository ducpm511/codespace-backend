import { MigrationInterface, QueryRunner, Table } from 'typeorm';

export class AddHolidayAndExtendTestType1690000000000
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. Tạo bảng holidays
    await queryRunner.createTable(
      new Table({
        name: 'holidays',
        columns: [
          {
            name: 'id',
            type: 'int',
            isPrimary: true,
            isGenerated: true,
            generationStrategy: 'increment',
          },
          {
            name: 'holidayDate',
            type: 'date',
            isUnique: true,
          },
          {
            name: 'reason',
            type: 'varchar',
            length: '255',
            isNullable: true,
          },
        ],
      }),
      true,
    );

    // 2. Chỉnh sửa enum testType (PostgreSQL only)
    await queryRunner.query(`
      ALTER TYPE "reportfileentity_testtype_enum"
      ADD VALUE IF NOT EXISTS 'certificate';
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // 1. Xóa bảng holidays
    await queryRunner.dropTable('holidays');

    // 2. Không thể rollback giá trị enum dễ dàng trong PostgreSQL,
    // nên bạn có thể để trống hoặc ghi chú rõ
    // (có thể tạo lại enum mới nếu cần, nhưng khá phức tạp)
  }
}
