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

  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // 1. Xóa bảng holidays
    await queryRunner.dropTable('holidays');

  }
}
