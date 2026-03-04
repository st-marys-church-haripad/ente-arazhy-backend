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

/* CORS */
const corsOptions = {
  origin(origin, callback) {
    if (
      config.NODE_ENV === 'development' ||
      !origin ||
      config.WHITELIST_ORIGINS.includes(origin)
    ) {
      callback(null, true);
    } else {
      callback(new Error(`CORS error: ${origin} is not allowed`), false);
    }
  }
};

app.use(cors(corsOptions));

/* Middlewares */
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(compression({ threshold: 1024 }));
// app.use(helmet()); // Temporarily disabled for React Native testing
app.use(limiter);

/* Static file serving for uploads */
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

/* Routes */
app.use('/api/v1', v1Router);

/* Error handler */
app.use(errorHandler);

/* Initialize database connection */
connectToDatabase().catch((err) => {
  console.error('Failed to connect to database:', err);
});

/* Export for Cloud Functions */
module.exports = app;

/* Start Server (for local development only) */
if (require.main === module) {
  const server = app.listen(PORT, () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
  });

  const shutdown = async () => {
    console.log('Shutting down server...');
    await disconnectFromDatabase();
    server.close(() => process.exit(0));
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}