/* Node Modules */
const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const helmet = require('helmet');
const compression = require('compression');
const path = require('path');
const dns = require('dns');

// Public DNS only for local development (e.g. Atlas SRV lookups).
// On Cloud Functions, Google's own resolver is faster and should be kept.
if (!process.env.K_SERVICE && !process.env.FUNCTION_TARGET) {
  dns.setServers(['8.8.8.8', '1.1.1.1']);
}

/* Custom Modules */
const config = require('./config');
const limiter = require('./lib/express_rate_limit');
const { connectToDatabase, disconnectFromDatabase } = require('./lib/mongoose');
const errorHandler = require('./middlewares/errorHandler');

/* Router */
const v1Router = require('./routes');

/* Init */
const app = express();
const PORT = config.PORT || 3000;

app.disable('x-powered-by');
app.set('trust proxy', 1); // needed so rate limiting sees the real client IP behind Google's proxy

/* CORS Configuration */
const corsOptions = {
  origin(origin, callback) {
    const isDevelopment = config.NODE_ENV === 'development';
    const isAllowed = !origin || config.WHITELIST_ORIGINS.includes(origin);

    if (isDevelopment || isAllowed) {
      callback(null, true);
    } else {
      const corsError = new Error(`CORS error: ${origin} is not allowed`);
      corsError.statusCode = 403;
      callback(corsError, false);
    }
  },
  credentials: true
};

/* Middleware Setup (cheap rejections first, expensive parsing last) */
app.use(helmet()); // Security headers
app.use(cors(corsOptions));
app.use(limiter); // Rate limiting
app.use(compression({ threshold: 1024 }));
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb', parameterLimit: 100 }));
app.use(cookieParser());

/* Personal data must never sit in shared caches; private + revalidation still gives fast 304s via ETag */
app.use('/api', (req, res, next) => {
  res.setHeader('Cache-Control', 'private, no-cache');
  next();
});

/* Static file serving for uploads */
app.use(
  '/uploads',
  express.static(path.join(__dirname, '../uploads'), {
    dotfiles: 'deny',
    index: false,
    cacheControl: false,
    setHeaders(res) {
      res.setHeader('Cache-Control', 'private, max-age=86400');
    }
  })
);

/* Health Check Endpoint */
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
});

/* Database Connection (lazy, cached, retried on failure) */
let databaseReady = null;
const ensureDatabase = () => {
  if (!databaseReady) {
    databaseReady = connectToDatabase().catch((err) => {
      databaseReady = null; // allow the next request to retry
      throw err;
    });
  }
  return databaseReady;
};

const databaseMiddleware = async (req, res, next) => {
  try {
    await ensureDatabase();
    next();
  } catch (err) {
    console.error('Database connection failed:', err);
    const dbError = new Error('Service temporarily unavailable');
    dbError.statusCode = 503;
    next(dbError);
  }
};

/* API Routes */
app.use('/api/v1', databaseMiddleware, v1Router);

/* 404 Handler */
app.use((req, res, next) => {
  const notFound = new Error('Route not found');
  notFound.statusCode = 404;
  next(notFound);
});

/* Error Handler Middleware */
app.use(errorHandler);

/* Export for Cloud Functions */
module.exports = app;

/* Start Server (for local development only) */
if (require.main === module) {
  ensureDatabase().catch((err) => {
    console.error('Failed to connect to database:', err);
    process.exit(1);
  });

  const server = app.listen(PORT, '0.0.0.0');

  const shutdown = () => {
    // Stop accepting requests first, then close the DB
    server.close(async () => {
      try {
        await disconnectFromDatabase();
      } finally {
        process.exit(0);
      }
    });
    setTimeout(() => process.exit(1), 10000).unref(); // force exit if requests hang
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}