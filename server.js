require('dotenv').config();
const path = require('path');
const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const bcryptjs = require('bcryptjs');
const cors = require('cors');

const app = express();
const port = process.env.PORT || 5000;
const db = new sqlite3.Database(process.env.DATABASE_URL || './logistics.db');

// Database setup
db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS shipments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    trackingNo TEXT,
    status TEXT,
    latitude REAL,
    longitude REAL
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE,
    password_hash TEXT,
    email TEXT
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS alarms (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    timestamp DATETIME NOT NULL,
    vehicle_id TEXT NOT NULL,
    alarm_type TEXT NOT NULL,
    location TEXT,
    description TEXT,
    status TEXT CHECK(status IN ('active', 'resolved')),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);
});

// Middleware
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST'],
  credentials: true
}));
app.use(express.json());
app.use(express.static(path.join(__dirname, 'project folder')));

// Routes
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'project folder', 'index.html'));
});

// ======================
// Authentication Routes
// ======================
app.post('/login', (req, res) => {
  db.get(
    'SELECT * FROM users WHERE username = ?',
    [req.body.username],
    async (err, user) => {
      if (err) return res.status(500).json({ error: "Database error" });
      if (!user) return res.status(400).json({ error: "Invalid credentials" });
      
      const validPassword = await bcryptjs.compare(req.body.password, user.password_hash);
      if (!validPassword) return res.status(400).json({ error: "Invalid credentials" });
      
      res.json({ 
        id: user.id, 
        username: user.username, 
        email: user.email || 'N/A' 
      });
    }
  );
});

app.post('/signup', async (req, res) => {
  const { username, password } = req.body;

  try {
    const hashedPassword = await bcryptjs.hash(password, 10);
    db.run(
      'INSERT INTO users (username, password_hash) VALUES (?, ?)',
      [username, hashedPassword],
      function (err) {
        if (err) {
          return res.status(400).json({ error: "Username already exists" });
        }
        res.json({ id: this.lastID, username });
      }
    );
  } catch (error) {
    res.status(500).json({ error: "Internal server error" });
  }
});

// ======================
// Alarm Routes (CRITICAL ADDITION)
// ======================
app.get('/api/alarms', (req, res) => {
  const { startDate, endDate, status } = req.query;
  
  let query = `SELECT * FROM alarms`;
  const params = [];

  if (startDate && endDate) {
    query += ` WHERE timestamp BETWEEN ? AND ?`;
    params.push(startDate, endDate);
  }

  if (status) {
    query += params.length ? ' AND' : ' WHERE';
    query += ` status = ?`;
    params.push(status);
  }

  query += ` ORDER BY timestamp DESC`;

  db.all(query, params, (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

// ======================
// Server Startup
// ======================
app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
