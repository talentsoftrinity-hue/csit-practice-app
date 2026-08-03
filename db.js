// backend/db.js
const Database = require('better-sqlite3');
const path = require('path');

// Use a persistent volume path on Railway, fallback to local
const dbPath = process.env.RAILWAY_VOLUME_MOUNT_PATH 
  ? path.join(process.env.RAILWAY_VOLUME_MOUNT_PATH, 'app.db')
  : 'app.db';

const db = new Database(dbPath);

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    email         TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    created_at    TEXT DEFAULT CURRENT_TIMESTAMP
  )
`);

// Create user_data table for game progress
db.exec(`
  CREATE TABLE IF NOT EXISTS user_data (
    user_id       INTEGER NOT NULL,
    points        INTEGER DEFAULT 0,
    owned_themes  TEXT DEFAULT '[]',
    active_theme  TEXT DEFAULT 'default',
    inventory     TEXT DEFAULT '{}',
    sandbox_grid  TEXT DEFAULT '[]',
    updated_at    TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    PRIMARY KEY (user_id)
  )
`);

module.exports = db;