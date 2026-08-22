const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { DatabaseSync } = require('node:sqlite');

const databasePath = process.env.THERAPYFLOW_DB_PATH || path.join(__dirname, 'therapyflow.db');
const seedPath = path.join(__dirname, 'data.json');
const database = new DatabaseSync(databasePath);
const collectionKeys = { moods: 'moodEntries', journals: 'journalEntries', assessments: 'assessments', sessions: 'sessions', appointments: 'appointments', messages: 'messages' };
const passwordSalt = process.env.THERAPYFLOW_PASSWORD_SALT || 'therapyflow-development-salt';
const demoPassword = process.env.THERAPYFLOW_DEMO_PASSWORD || 'demo-password';

database.exec(`
  PRAGMA journal_mode = WAL;
  CREATE TABLE IF NOT EXISTS clients (id INTEGER PRIMARY KEY, data TEXT NOT NULL);
  CREATE TABLE IF NOT EXISTS users (username TEXT PRIMARY KEY, data TEXT NOT NULL, password_hash TEXT NOT NULL);
  CREATE TABLE IF NOT EXISTS records (
    id TEXT PRIMARY KEY,
    collection TEXT NOT NULL,
    client_id INTEGER NOT NULL,
    data TEXT NOT NULL,
    created_at TEXT NOT NULL,
    FOREIGN KEY (client_id) REFERENCES clients(id)
  );
  CREATE INDEX IF NOT EXISTS records_client_collection ON records(client_id, collection);
`);

function seedIfEmpty() {
  const count = database.prepare('SELECT COUNT(*) AS count FROM clients').get().count;
  const recordCount = database.prepare('SELECT COUNT(*) AS count FROM records').get().count;
  if (!fs.existsSync(seedPath)) return;
  const seed = JSON.parse(fs.readFileSync(seedPath, 'utf8'));
  const insertClient = database.prepare('INSERT INTO clients (id, data) VALUES (?, ?)');
  const insertRecord = database.prepare('INSERT INTO records (id, collection, client_id, data, created_at) VALUES (?, ?, ?, ?, ?)');
  database.exec('BEGIN');
  try {
    if (!count) for (const client of seed.clients) insertClient.run(client.id, JSON.stringify(client));
    const insertUser = database.prepare('INSERT OR IGNORE INTO users (username, data, password_hash) VALUES (?, ?, ?)');
    insertUser.run('therapist', JSON.stringify({ id: 'therapist-1', role: 'therapist', name: 'Dr. Nyawose' }), crypto.scryptSync(demoPassword, passwordSalt, 32).toString('hex'));
    insertUser.run('sarah', JSON.stringify({ id: 'client-1', role: 'client', name: 'Sarah Dlamini', clientId: 1 }), crypto.scryptSync(demoPassword, passwordSalt, 32).toString('hex'));
    if (!recordCount) for (const [collection, key] of Object.entries(collectionKeys)) for (const record of seed[key] || []) insertRecord.run(record.id || `${collection}-${record.clientId}-${Date.now()}`, collection, record.clientId, JSON.stringify(record), record.createdAt || new Date().toISOString());
    database.exec('COMMIT');
  } catch (error) {
    database.exec('ROLLBACK');
    throw error;
  }
}

seedIfEmpty();

function clientsForUser(user) {
  const rows = user.role === 'therapist' ? database.prepare('SELECT data FROM clients ORDER BY id').all() : database.prepare('SELECT data FROM clients WHERE id = ?').all(user.clientId);
  return rows.map((row) => JSON.parse(row.data));
}

function authenticateUser(username, password) {
  const row = database.prepare('SELECT data, password_hash FROM users WHERE username = ?').get(String(username || '').toLowerCase());
  if (!row) return null;
  const supplied = crypto.scryptSync(String(password || ''), passwordSalt, 32).toString('hex');
  if (supplied.length !== row.password_hash.length || !crypto.timingSafeEqual(Buffer.from(supplied), Buffer.from(row.password_hash))) return null;
  return JSON.parse(row.data);
}

function recordsForClient(collection, clientId) {
  return database.prepare('SELECT data FROM records WHERE collection = ? AND client_id = ? ORDER BY created_at').all(collection, clientId).map((row) => JSON.parse(row.data));
}

function addRecord(collection, clientId, body, id, createdAt) {
  const record = { ...body, clientId: Number(clientId), id, createdAt };
  database.prepare('INSERT INTO records (id, collection, client_id, data, created_at) VALUES (?, ?, ?, ?, ?)').run(id, collection, Number(clientId), JSON.stringify(record), createdAt);
  return record;
}

module.exports = { clientsForUser, recordsForClient, addRecord, authenticateUser };
