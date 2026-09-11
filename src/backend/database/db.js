import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const isVercel = Boolean(process.env.VERCEL);

const databasePath = isVercel
    ? path.join('/tmp', 'metal-racing.db')
    : path.join(__dirname, 'metal-racing.db');

if (isVercel) {
    const bundledDatabasePath = path.join(__dirname, 'metal-racing.db');

    if (!fs.existsSync(databasePath) && fs.existsSync(bundledDatabasePath)) {
        fs.copyFileSync(bundledDatabasePath, databasePath);
    }
}

const databaseDir = path.dirname(databasePath);

if (!fs.existsSync(databaseDir)) {
    fs.mkdirSync(databaseDir, { recursive: true });
}

if (!fs.existsSync(databasePath)) {
    throw new Error(`Banco SQLite não encontrado: ${databasePath}`);
}

const db = new Database(databasePath);

db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

export default db;
