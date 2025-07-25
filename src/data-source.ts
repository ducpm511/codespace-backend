import { DataSource } from 'typeorm';
import * as dotenv from 'dotenv';

dotenv.config();

export const AppDataSource = new DataSource({
  type: 'postgres',
  url: process.env.DATABASE_URL,
  synchronize: process.env.TYPEORM_SYNC === 'true',
  logging: process.env.TYPEORM_LOGGING === 'true',
  entities: [process.env.NODE_ENV === 'production' ? 'dist/entities/**/*.js' : 'src/entities/**/*.ts'],
  migrations: [process.env.NODE_ENV === 'production' ? 'dist/migrations/**/*.js' : 'src/migrations/**/*.ts'],
  subscribers: [],
});
