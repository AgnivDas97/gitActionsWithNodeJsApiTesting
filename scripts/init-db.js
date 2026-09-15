require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

const host = process.env.PGHOST || 'localhost';
const port = parseInt(process.env.PGPORT || '5432', 10);
const user = process.env.PGUSER || 'postgres';
const password = process.env.PGPASSWORD || 'postgres';
const targetDb = process.env.PGDATABASE || 'dummy-user-data';

async function initDatabase() {
  console.log(`Checking connection to PostgreSQL at ${host}:${port} as ${user}...`);

  // Step 1: Connect to default 'postgres' database to ensure target database exists
  const adminClient = new Client({
    host,
    port,
    user,
    password,
    database: 'postgres'
  });

  try {
    await adminClient.connect();
    const checkRes = await adminClient.query(
      `SELECT 1 FROM pg_database WHERE datname = $1`,
      [targetDb]
    );

    if (checkRes.rowCount === 0) {
      console.log(`Database "${targetDb}" does not exist. Creating...`);
      await adminClient.query(`CREATE DATABASE "${targetDb}"`);
      console.log(`Database "${targetDb}" created successfully.`);
    } else {
      console.log(`Database "${targetDb}" already exists.`);
    }
  } catch (err) {
    console.warn(`Note: Could not check/create database from admin client: ${err.message}`);
  } finally {
    await adminClient.end().catch(() => {});
  }

  // Step 2: Connect to target database and execute init.sql
  const dbClient = new Client({
    host,
    port,
    user,
    password,
    database: targetDb
  });

  try {
    await dbClient.connect();
    console.log(`Connected to database "${targetDb}". Executing init.sql schema & seed...`);

    const sqlPath = path.join(__dirname, '..', 'init.sql');
    const sqlContent = fs.readFileSync(sqlPath, 'utf8');

    await dbClient.query(sqlContent);
    console.log('Database schema and seed records initialized successfully!');
  } catch (err) {
    console.error(`Error initializing database schema: ${err.message}`);
    process.exit(1);
  } finally {
    await dbClient.end().catch(() => {});
  }
}

if (require.main === module) {
  initDatabase();
}

module.exports = initDatabase;
