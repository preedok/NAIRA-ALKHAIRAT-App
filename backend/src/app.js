const path = require('path');
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const cookieParser = require('cookie-parser');
const { UPLOAD_ROOT, SUBDIRS, getDir } = require('./config/uploads');

// Pastikan folder uploads (workflow inti) ada saat startup
try {
  getDir(SUBDIRS.MOU);
  getDir(SUBDIRS.REGISTRATION_PAYMENT);
  getDir(SUBDIRS.PAYMENT_PROOFS);
  getDir(SUBDIRS.MANIFEST_VISA);
  getDir(SUBDIRS.MANIFEST_TICKET);
  getDir(SUBDIRS.VISA_DOCS);
  getDir(SUBDIRS.TICKET_DOCS);
  getDir(SUBDIRS.HOTEL_DOCS);
  getDir(SUBDIRS.INVOICES);
} catch (e) { /* ignore */ }

const app = express();

/** Satu origin atau beberapa (koma/spasi), mis. https://domain.id,https://dev.sub.domain.id */
function parseCorsOrigins() {
  const raw = process.env.CORS_ORIGIN || 'http://localhost:3000';
  return raw.split(/[,\s]+/).map((s) => s.trim()).filter(Boolean);
}

const corsOrigins = parseCorsOrigins();
const corsOptions =
  corsOrigins.length === 0
    ? { origin: 'http://localhost:3000', credentials: true }
    : corsOrigins.length === 1
      ? { origin: corsOrigins[0], credentials: true }
      : { origin: corsOrigins, credentials: true };

app.use(helmet());
app.use(cors(corsOptions));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(compression());
// File disimpan di project root / uploads (bukan di backend/uploads)
app.use('/uploads', express.static(UPLOAD_ROOT));

app.get('/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    message: 'Bintang Global API is running',
    database: 'PostgreSQL'
  });
});

// Serve uploads under /api/v1/uploads so Nginx proxy to backend serves files (avoid 404 on /uploads)
app.use('/api/v1/uploads', express.static(UPLOAD_ROOT));

app.use('/api/v1', require('./routes/v1'));

app.use((req, res) => {
  console.warn('[404]', req.method, req.originalUrl);
  res.status(404).json({ 
    success: false, 
    message: 'Route not found',
    path: req.method + ' ' + req.originalUrl
  });
});

const systemLogger = require('./middleware/systemLogger');
app.use(systemLogger);

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(err.status || 500).json({
    success: false,
    message: err.message || 'Internal Server Error'
  });
});

module.exports = app;
