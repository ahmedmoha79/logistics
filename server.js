require('dotenv').config();

const bcryptjsSaltRounds = process.env.BCRYPTJS_SALT_ROUNDS || 10;
const dbUrl = process.env.DATABASE_URL || './logistics.db';

const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const bcryptjs = require('bcryptjs');
const cors = require('cors');
const app = express();
const port = process.env.PORT || 5000;

// Database setup
const db = new sqlite3.Database(process.env.DATABASE_URL || './logistics.db');

// Create tables (existing code remains unchanged)
db.serialize(() => {
  // ... your existing table creation code ...
});

// Middleware
app.use(cors());
app.use(express.json());

// Serve static files from the "project_folder" directory
app.use(express.static('project folder')); // <-- Added this line

// Route for the root URL ("/") to serve the login page
app.get('/', (req, res) => { // <-- Added this route
  res.sendFile(__dirname + '/project folder/index.html');
});

// ======================
// Authentication Routes (existing code remains unchanged)
// ======================
app.post('/signup', async (req, res) => { /* ... */ });
app.post('/login', (req, res) => { /* ... */ });

// ======================
// User Account Route (existing code remains unchanged)
// ======================
app.get('/api/user', (req, res) => { /* ... */ });

// ======================
// Shipment Routes (existing code remains unchanged)
// ======================
app.get('/api/shipments', (req, res) => { /* ... */ });
app.get('/api/shipments/:id/gps', (req, res) => { /* ... */ });
app.put('/api/shipments/:id/gps', (req, res) => { /* ... */ });

// ======================
// Alarm Routes (existing code remains unchanged)
// ======================
app.get('/api/alarms', (req, res) => { /* ... */ });

app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
});
