const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const path = require('path');

const authRoutes = require('./routes/authRoutes');
const employeeRoutes = require('./routes/employeeRoutes');
const attendanceRoutes = require('./routes/attendanceRoutes');
const trackingRoutes = require('./routes/trackingRoutes');
const breakRoutes = require('./routes/breakRoutes');
const photoRoutes = require('./routes/photoRoutes');
const reportRoutes = require('./routes/reportRoutes');
const settingsRoutes = require('./routes/settingsRoutes');
const dashboardRoutes = require('./routes/dashboardRoutes');

const { errorHandler } = require('./middleware/errorHandler');

const app = express();

app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));

const corsOriginEnv = process.env.CORS_ORIGIN;
app.use(cors({
  origin: (origin, callback) => {
    // Allow non-browser clients (such as Flutter mobile app, curl, server-to-server)
    if (!origin) return callback(null, true);

    // If not set, or set to wildcard/true, allow origin
    if (!corsOriginEnv || corsOriginEnv === '*' || corsOriginEnv === 'true') {
      return callback(null, true);
    }

    const allowedOrigins = corsOriginEnv.split(',').map(o => o.trim());
    if (
      allowedOrigins.includes(origin) ||
      (allowedOrigins.some(o => o.includes('vercel.app')) && origin.endsWith('.vercel.app'))
    ) {
      return callback(null, true);
    }

    return callback(null, false);
  },
  credentials: true
}));

app.use((req, res, next) => {
  console.log(`[HTTP ${new Date().toLocaleTimeString()}] ${req.method} ${req.originalUrl}`);
  next();
});

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 500,
  standardHeaders: true,
  legacyHeaders: false
});
app.use(limiter);

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

app.use('/uploads', express.static(path.join(__dirname, '..', 'uploads')));
app.use('/photos', express.static(path.join(__dirname, '..', 'uploads', 'photos')));
app.use('/thumbnails', express.static(path.join(__dirname, '..', 'uploads', 'thumbnails')));

app.use('/api/auth', authRoutes);
app.use('/api/employees', employeeRoutes);
app.use('/api/attendance', attendanceRoutes);
app.use('/api/tracking', trackingRoutes);
app.use('/api/breaks', breakRoutes);
app.use('/api/photos', photoRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/dashboard', dashboardRoutes);

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.use(errorHandler);

module.exports = app;
