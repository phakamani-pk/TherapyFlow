const fs = require('fs');
const path = require('path');
const { DatabaseSync } = require('node:sqlite');

const databasePath = process.env.THERAPYFLOW_DB_PATH || path.join(__dirname, 'therapyflow.db');
const seedPath = path.join(__dirname, 'data.json');
const database = new DatabaseSync(databasePath);
const collectionKeys = { moods: 'moodEntries', journals: 'journalEntries', assessments: 'assessments', sessions: 'sessions', appointments: 'appointments', messages: 'messages' };

database.exec(`
  PRAGMA journal_mode = WAL;
  CREATE TABLE IF NOT EXISTS clients (id INTEGER PRIMARY KEY, data TEXT NOT NULL);
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
  if (count || !fs.existsSync(seedPath)) return;
  const seed = JSON.parse(fs.readFileSync(seedPath, 'utf8'));
  const insertClient = database.prepare('INSERT INTO clients (id, data) VALUES (?, ?)');
  const insertRecord = database.prepare('INSERT INTO records (id, collection, client_id, data, created_at) VALUES (?, ?, ?, ?, ?)');
  database.exec('BEGIN');
  try {
    for (const client of seed.clients) insertClient.run(client.id, JSON.stringify(client));
    for (const [collection, key] of Object.entries(collectionKeys)) for (const record of seed[key] || []) insertRecord.run(record.id || `${collection}-${record.clientId}-${Date.now()}`, collection, record.clientId, JSON.stringify(record), record.createdAt || new Date().toISOString());
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

function recordsForClient(collection, clientId) {
  return database.prepare('SELECT data FROM records WHERE collection = ? AND client_id = ? ORDER BY created_at').all(collection, clientId).map((row) => JSON.parse(row.data));
}

function addRecord(collection, clientId, body, id, createdAt) {
  const record = { ...body, clientId: Number(clientId), id, createdAt };
  database.prepare('INSERT INTO records (id, collection, client_id, data, created_at) VALUES (?, ?, ?, ?, ?)').run(id, collection, Number(clientId), JSON.stringify(record), createdAt);
  return record;
}

module.exports = { clientsForUser, recordsForClient, addRecord };
