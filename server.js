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

// SQLite Connection
const db = new sqlite3.Database('./logistics.db');

// MongoDB Connection
const MONGO_URI = 'mongodb+srv://mohamedbeyhaqi:bQJx9JfwQNlJEXOE@cluster0.eu65h.mongodb.net/phoneTracker?retryWrites=true&w=majority';
mongoose.connect(MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
})
.then(() => console.log('MongoDB Connected'))
.catch(err => console.error('MongoDB Error:', err));

// MongoDB Phone Schema
const phoneSchema = new mongoose.Schema({
  deviceId: { type: String, required: true, unique: true },
  latitude: { type: Number, required: true },
  longitude: { type: Number, required: true },
  timestamp: { type: Date, default: Date.now },
  batteryLevel: { type: Number, required: true },
  status: { type: String, enum: ['active', 'inactive'], default: 'active' },
  os: {
    name: String,
    version: String
  },
  hardware: {
    memory: String,
    cores: Number,
    model: String
  }
});
const Phone = mongoose.model('Phone', phoneSchema);

// ======================
// Middleware
// ======================
app.use(cors({ origin: '*' }));
app.use(express.json());
app.use(express.static(path.join(__dirname, 'project folder')));

// ======================
// Routes
// ======================

// Phone Tracking API
app.post('/api/gps', async (req, res) => {
  try {
    const { deviceId, latitude, longitude, deviceInfo } = req.body;
    
    const phoneData = {
      deviceId,
      latitude,
      longitude,
      batteryLevel: deviceInfo?.hardware?.battery?.level || 0,
      os: deviceInfo?.os || {},
      hardware: deviceInfo?.hardware || {},
      status: 'active'
    };

    await Phone.findOneAndUpdate(
      { deviceId },
      phoneData,
      { upsert: true, new: true }
    );

    res.status(200).send('Location updated');
  } catch (error) {
    console.error('GPS Error:', error);
    res.status(500).send('Server error');
  }
});

app.get('/api/phones', async (req, res) => {
  try {
    const phones = await Phone.find().sort({ timestamp: -1 });
    res.json(phones);
  } catch (error) {
    console.error('Phones Error:', error);
    res.status(500).send('Server error');
  }
});

// ... [Keep all your original SQLite routes unchanged] ...

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
