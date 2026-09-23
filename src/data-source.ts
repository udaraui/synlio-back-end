import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { config } from 'dotenv';
import * as path from 'path';

config();
const isProd = process.env.NODE_ENV === 'production';
export const AppDataSource = new DataSource({
  type: 'postgres',
  url: process.env.PG_DB_URL,
  entities: [
    path.join(__dirname, isProd ? '/**/*.entity.js' : '/**/*.entity.ts'),
  ],
  migrations: [
    path.join(__dirname, isProd ? '/migrations/*.js' : '/migrations/*.ts'),
  ],
  migrationsRun: true,
  ssl: isProd ? { rejectUnauthorized: false } : false,
  synchronize: false,
});
