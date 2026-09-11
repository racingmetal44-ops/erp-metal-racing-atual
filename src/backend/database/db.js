import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const isVercel = Boolean(process.env.VERCEL);

const bundledDatabasePath = path.join(__dirname, 'metal-racing.db');

const databasePath = isVercel
    ? path.join('/tmp', 'metal-racing.db')
    : bundledDatabasePath;

if (isVercel && !fs.existsSync(databasePath)) {
    if (!fs.existsSync(bundledDatabasePath)) {
        throw new Error(
            `Banco SQLite não foi incluído na Function. Procurado em: ${bundledDatabasePath}`
        );
    }

    fs.copyFileSync(bundledDatabasePath, databasePath);
}

const databaseDir = path.dirname(databasePath);

if (!fs.existsSync(databaseDir)) {
    fs.mkdirSync(databaseDir, { recursive: true });
}

if (!fs.existsSync(databasePath)) {
    throw new Error(`Banco SQLite não encontrado: ${databasePath}`);
}

const db = new Database(databasePath);

if (!isVercel) {
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
}

export default db;
