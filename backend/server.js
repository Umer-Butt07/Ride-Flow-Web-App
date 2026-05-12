require('dotenv').config();
const express = require('express');
const cors    = require('cors');

const authRoutes    = require('./routes/auth.routes');
const driverRoutes  = require('./routes/driver.routes');
const riderRoutes   = require('./routes/rider.routes');
const adminRoutes   = require('./routes/admin.routes');
const reportRoutes  = require('./routes/reports.routes');

const app  = express();
const PORT = process.env.PORT || 5000;

const path = require('path');

// ─── Middleware ────────────────────────────────────────────────────
app.use(cors());
app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// ─── Health check ─────────────────────────────────────────────────
app.get('/api/health', (req, res) =>
  res.json({ status: 'ok', message: 'RideFlow API is running 🚗' })
);

// ─── Routes ───────────────────────────────────────────────────────
app.use('/api/auth',    authRoutes);
app.use('/api/driver',  driverRoutes);
app.use('/api/rider',   riderRoutes);
app.use('/api/admin',   adminRoutes);
app.use('/api/reports', reportRoutes);

// ─── 404 handler ──────────────────────────────────────────────────
app.use((req, res) => res.status(404).json({ error: 'Route not found' }));

// ─── Global error handler ─────────────────────────────────────────
app.use((err, req, res, next) => {
  console.error('[ERROR]', err.message);
  res.status(err.status || 500).json({ error: err.message || 'Internal Server Error' });
});

// ─── Start ────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`✅  RideFlow API listening on http://localhost:${PORT}`);
});
