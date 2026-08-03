// backend/server.js
require('dotenv').config();

const express = require('express');
const cors = require('cors');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

const db = require('./db');
const { requireAuth } = require('./middleware/auth');

const app = express();
app.use(cors());
app.use(express.json());

const SALT_ROUNDS = 12;
const DUMMY_HASH = '$2b$12$C6UzMDM.H6dfI/f/IKcEeO7GcvxRt5aLLZmzB.dV13BqXsHPcxdX2';

// Register endpoint
app.post('/register', async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }
  if (password.length < 8) {
    return res.status(400).json({ error: 'Password must be at least 8 characters' });
  }

  const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
  if (existing) {
    return res.status(409).json({ error: 'An account with that email already exists' });
  }

  const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
  
  // Insert user
  const info = db
    .prepare('INSERT INTO users (email, password_hash) VALUES (?, ?)')
    .run(email, passwordHash);
  
  const userId = info.lastInsertRowid;

  // Initialize user data
  db.prepare(`
    INSERT INTO user_data (user_id, points, owned_themes, active_theme, inventory, sandbox_grid)
    VALUES (?, 0, '[]', 'default', '{}', '[]')
  `).run(userId);

  const token = signToken(userId);
  res.status(201).json({ token, user: { id: userId, email } });
});

// Login endpoint
app.post('/login', async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }

  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
  const hashToCheck = user ? user.password_hash : DUMMY_HASH;
  const valid = await bcrypt.compare(password, hashToCheck);

  if (!user || !valid) {
    return res.status(401).json({ error: 'Invalid email or password' });
  }

  const token = signToken(user.id);
  res.json({ token, user: { id: user.id, email: user.email } });
});

// Get user profile with game data
app.get('/profile', requireAuth, (req, res) => {
  const user = db
    .prepare('SELECT id, email, created_at FROM users WHERE id = ?')
    .get(req.userId);

  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }

  const userData = db
    .prepare('SELECT points, owned_themes, active_theme, inventory, sandbox_grid FROM user_data WHERE user_id = ?')
    .get(req.userId);

  res.json({ 
    user, 
    gameData: userData || { points: 0, owned_themes: '[]', active_theme: 'default', inventory: '{}', sandbox_grid: '[]' }
  });
});

// Update user game data
app.post('/profile/update', requireAuth, async (req, res) => {
  const { points, owned_themes, active_theme, inventory, sandbox_grid } = req.body;
  const userId = req.userId;

  try {
    db.prepare(`
      INSERT INTO user_data (user_id, points, owned_themes, active_theme, inventory, sandbox_grid, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(user_id) DO UPDATE SET
        points = excluded.points,
        owned_themes = excluded.owned_themes,
        active_theme = excluded.active_theme,
        inventory = excluded.inventory,
        sandbox_grid = excluded.sandbox_grid,
        updated_at = CURRENT_TIMESTAMP
    `).run(userId, points || 0, owned_themes || '[]', active_theme || 'default', inventory || '{}', sandbox_grid || '[]');

    res.json({ success: true });
  } catch (err) {
    console.error('Error updating user data:', err);
    res.status(500).json({ error: 'Failed to update user data' });
  }
});

function signToken(userId) {
  return jwt.sign({ sub: userId }, process.env.JWT_SECRET, { expiresIn: '7d' });
}

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));