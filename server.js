require('dotenv').config();
const path = require('path');
const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const bcryptjs = require('bcryptjs');
const cors = require('cors');
const mongoose = require('mongoose');

const app = express();
const port = process.env.PORT || 5000;

// ======================
// Database Connections
// ======================

// SQLite Database (for users, alarms, etc.)
const db = new sqlite3.Database(process.env.DATABASE_URL || './logistics.db');

// MongoDB Connection (for phone tracking)
const MONGO_URI = process.env.MONGO_URI || 'mongodb+srv://mohamedbeyhaqi:bQJx9JfwQNlJEXOE@cluster0.eu65h.mongodb.net/phoneTracker?retryWrites=true&w=majority';
mongoose.connect(MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
  .then(() => console.log('Connected to MongoDB'))
  .catch(err => console.error('MongoDB connection error:', err));

// MongoDB Schema for Phone Tracking
const phoneSchema = new mongoose.Schema({
  deviceId: { type: String, required: true, unique: true },
  latitude: { type: Number, required: true },
  longitude: { type: Number, required: true },
  timestamp: { type: Date, default: Date.now },
  status: { type: String, enum: ['active', 'inactive'], default: 'active' },
  batteryLevel: { type: Number, required: true },
  os: {
    name: { type: String },
    version: { type: String },
  },
  hardware: {
    memory: { type: String },
    cores: { type: Number },
    model: { type: String },
  },
});

const Phone = mongoose.model('Phone', phoneSchema);

// ======================
// Middleware
// ======================
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST'],
  credentials: true,
}));
app.use(express.json());
app.use(express.static(path.join(__dirname, 'project folder')));

// ======================
// Routes
// ======================

// Home Route
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'project folder', 'index.html'));
});

// ======================
// Authentication Routes (SQLite)
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
        email: user.email || 'N/A',
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
// Phone Tracking Routes (MongoDB)
// ======================

// Save Phone Location
app.post('/api/gps', async (req, res) => {
  const { deviceId, latitude, longitude, deviceInfo } = req.body;

  try {
    const phone = await Phone.findOneAndUpdate(
      { deviceId },
      {
        $set: {
          latitude,
          longitude,
          batteryLevel: deviceInfo.hardware.battery.level,
          os: deviceInfo.os,
          hardware: {
            memory: deviceInfo.hardware.memory,
            cores: deviceInfo.hardware.cores,
            model: deviceInfo.device.model,
          },
          status: 'active',
          timestamp: new Date(),
        },
      },
      { upsert: true, new: true }
    );

    res.status(200).json({ message: 'Location updated', phone });
  } catch (error) {
    console.error('Error saving location:', error);
    res.status(500).json({ error: 'Failed to save location' });
  }
});

// Get All Phones
app.get('/api/phones', async (req, res) => {
  try {
    const phones = await Phone.find().sort({ timestamp: -1 });
    res.json(phones);
  } catch (error) {
    console.error('Error fetching phones:', error);
    res.status(500).json({ error: 'Failed to fetch phones' });
  }
});

// ======================
// Shipments Route (SQLite)
// ======================
app.get('/api/shipments', (req, res) => {
  db.all('SELECT * FROM shipments', (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

// ======================
// Alarm Routes (SQLite)
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
