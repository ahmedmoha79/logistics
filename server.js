require('dotenv').config();

const bcryptjsSaltRounds = process.env.BCRYPTJS_SALT_ROUNDS || 10;  // Default to 10 if not set
const dbUrl = process.env.DATABASE_URL || './logistics.db';      // Default database URL if not set

const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const bcryptjs = require('bcryptjs');
const cors = require('cors');
const app = express();
const port = process.env.PORT || 5000;

// Database setup
const db = new sqlite3.Database(process.env.DATABASE_URL || './logistics.db');

// Create tables
db.serialize(() => {
  // Shipments table
  db.run(`CREATE TABLE IF NOT EXISTS shipments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    trackingNo TEXT,
    status TEXT,
    latitude REAL,
    longitude REAL
  )`);

  // Users table
  db.run(`CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE,
    password_hash TEXT,
    email TEXT
  )`);

  // Alarms table (NEW)
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

  // Insert sample alarm data (optional)
  db.run(`INSERT OR IGNORE INTO alarms (timestamp, vehicle_id, alarm_type, location, description, status) VALUES
    ('2023-10-05 14:30:00', 'BAP760ZM', 'Engine Overheat', 'Nairobi', 'Engine temperature exceeded 120°C', 'active'),
    ('2023-10-04 09:15:00', 'TRUCK001', 'Low Fuel', 'Mombasa', 'Fuel level below 15%', 'resolved')`);
});

// Middleware
app.use(cors());
app.use(express.json());

// ======================
// Authentication Routes
// ======================
app.post('/signup', async (req, res) => {
  try {
    const hashedPassword = await bcryptjs.hash(
      req.body.password,
      parseInt(process.env.BCRYPTJS_SALT_ROUNDS) || 10
    );
    db.run(
      'INSERT INTO users (username, password_hash, email) VALUES (?, ?, ?)',
      [req.body.username, hashedPassword, req.body.email || null],
      function(err) {
        if (err) return res.status(400).json({ error: "Username already exists" });
        res.json({ id: this.lastID, username: req.body.username });
      }
    );
  } catch {
    res.status(500).json({ error: "Internal server error" });
  }
});

app.post('/login', (req, res) => {
  db.get(
    'SELECT * FROM users WHERE username = ?',
    [req.body.username],
    async (err, user) => {
      if (!user) return res.status(400).json({ error: "Invalid credentials" });
      
      const validPassword = await bcryptjs.compare(req.body.password, user.password_hash);
      if (!validPassword) return res.status(400).json({ error: "Invalid credentials" });
      
      res.json({ id: user.id, username: user.username, email: user.email || 'N/A' });
    }
  );
});

// ======================
// User Account Route
// ======================
app.get('/api/user', (req, res) => {
  const userId = req.query.userId;
  if (!userId) return res.status(400).json({ error: "User ID is required" });

  db.get(
    'SELECT id, username, email FROM users WHERE id = ?',
    [userId],
    (err, user) => {
      if (err) return res.status(500).json({ error: err.message });
      if (!user) return res.status(404).json({ error: "User not found" });
      res.json(user);
    }
  );
});

// ======================
// Shipment Routes
// ======================
app.get('/api/shipments', (req, res) => {
  db.all('SELECT * FROM shipments', (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
    } else {
      res.json(rows);
    }
  });
});

app.get('/api/shipments/:id/gps', (req, res) => {
  const shipmentId = req.params.id;
  db.get('SELECT latitude, longitude FROM shipments WHERE id = ?', [shipmentId], (err, row) => {
    if (err) {
      res.status(500).json({ error: err.message });
    } else if (row) {
      res.json(row);
    } else {
      res.status(404).json({ error: 'Shipment not found' });
    }
  });
});

app.put('/api/shipments/:id/gps', (req, res) => {
  const shipmentId = req.params.id;
  const { latitude, longitude } = req.body;
  db.run(
    'UPDATE shipments SET latitude = ?, longitude = ? WHERE id = ?',
    [latitude, longitude, shipmentId],
    function (err) {
      if (err) {
        res.status(500).json({ error: err.message });
      } else if (this.changes === 0) {
        res.status(404).json({ error: 'Shipment not found' });
      } else {
        res.json({ id: shipmentId, latitude, longitude });
      }
    }
  );
});

// ====================== (NEW SECTION)
// Alarm Routes
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

app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
});
