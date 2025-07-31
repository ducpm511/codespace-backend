import { DataSource } from 'typeorm';
import * as dotenv from 'dotenv';

dotenv.config();

export const AppDataSource = new DataSource({
  type: 'postgres',
  host: process.env.DATABASE_HOST,
  port: Number(process.env.DATABASE_PORT),
  username: process.env.DATABASE_USERNAME,
  password: process.env.DATABASE_PASSWORD,
  database: process.env.DATABASE_NAME,
  synchronize: false,
  logging: process.env.TYPEORM_LOGGING === 'true',
  entities: [
    process.env.NODE_ENV === 'production'
      ? 'dist/entities/**/*.js'
      : 'src/entities/**/*.ts',
  ],
  migrations: [
    process.env.NODE_ENV === 'production'
      ? 'dist/migrations/**/*.js'
      : 'src/migrations/**/*.ts',
  ],
  subscribers: [],
});
