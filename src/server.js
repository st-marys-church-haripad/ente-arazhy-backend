/* Node Modules */
const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const helmet = require('helmet');
const compression = require('compression');
const path = require('path');

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

app.use(cors(corsOptions));

/* Middleware Setup */
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser());
app.use(compression({ threshold: 1024 }));
app.use(helmet()); // Security headers
app.use(limiter); // Rate limiting

/* Static file serving for uploads */
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

/* Health Check Endpoint */
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
});

/* API Routes */
app.use('/api/v1', v1Router);

/* Error Handler Middleware */
app.use(errorHandler);

/* Database Connection */
connectToDatabase().catch((err) => {
  throw err;
});

/* Export for Cloud Functions */
module.exports = app;

/* Start Server (for local development only) */
if (require.main === module) {
  const server = app.listen(PORT);

  const shutdown = async () => {
    await disconnectFromDatabase();
    server.close(() => process.exit(0));
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}