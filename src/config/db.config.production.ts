import { PostgresConnectionOptions } from 'typeorm/driver/postgres/PostgresConnectionOptions';
import * as path from 'path';

export default (): PostgresConnectionOptions => ({
  type: 'postgres',
  url: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false, // Render yêu cầu dùng SSL
  },
  synchronize: true,
  entities: [path.join(__dirname, '..', '**', '*.entity.{ts,js}')],
});
