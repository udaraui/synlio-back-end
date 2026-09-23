import 'reflect-metadata';
import { AppDataSource } from './data-source';

async function run() {
  try {
    await AppDataSource.initialize();
    console.log('Database initialized');
    await AppDataSource.runMigrations();
    console.log('Migrations executed');
    process.exit(0);
  } catch (err) {
    console.error('Migration failed', err);
    process.exit(1);
  }
}

run();
