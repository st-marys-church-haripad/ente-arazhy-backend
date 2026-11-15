const mongoose = require('mongoose');
const config = require('../config');

const clientOptions = {
    dbName: 'enteArazhyDB',
    appName: 'enteArazhyAppBackend',
    serverApi: {
        version: '1',
        strict: true,
        deprecationErrors: true,
    },
    // Added: serverless-friendly tuning (many function instances share one Atlas connection limit)
    maxPoolSize: 10,
    minPoolSize: 0,
    serverSelectionTimeoutMS: 5000,
    socketTimeoutMS: 45000,
    autoIndex: false
};

const EMAIL_INDEX_NAME = 'email_unique_partial';
// Only indexes real, non-empty string emails (excludes missing, null and '')
const EMAIL_PARTIAL_FILTER = { email: { $gt: '' } };

let connectionPromise = null;

/**
 * Connect to MongoDB (safe to call many times: reuses the same connection)
 */
const connectToDatabase = async () => {
  if (mongoose.connection.readyState === 1) return;

  if (!connectionPromise) {
    connectionPromise = (async () => {
      await mongoose.connect(config.MONGO_URI, clientOptions);
      await ensureEmailIndex();
    })().catch((error) => {
      connectionPromise = null; // allow a retry on the next request
      throw error;
    });
  }

  return connectionPromise;
};

/**
 * Ensure Email Index
 * Partial unique index for member emails. Creates the new index first and only
 * then removes outdated ones, so uniqueness is never unprotected.
 * Does nothing when the correct index already exists.
 */
const ensureEmailIndex = async () => {
  try {
    const collection = mongoose.connection.collection('members');

    let indexes = [];
    try {
      indexes = await collection.indexes();
    } catch (err) {
      if (err.code !== 26) throw err; // 26 = collection does not exist yet
    }

    // Only UNIQUE single-field email indexes are managed here.
    // The plain sparse lookup index created by the schema is left alone.
    const uniqueEmailIndexes = indexes.filter(
      (idx) =>
        idx.unique === true &&
        idx.key &&
        Object.keys(idx.key).length === 1 &&
        idx.key.email === 1
    );

    const isDesired = (idx) =>
      !idx.sparse &&
      JSON.stringify(idx.partialFilterExpression) === JSON.stringify(EMAIL_PARTIAL_FILTER);

    const desired = uniqueEmailIndexes.find(isDesired);

    if (!desired) {
      await collection.createIndex(
        { email: 1 },
        {
          name: EMAIL_INDEX_NAME,
          unique: true,
          partialFilterExpression: EMAIL_PARTIAL_FILTER,
        }
      );
    }

    const keepName = desired ? desired.name : EMAIL_INDEX_NAME;
    for (const idx of uniqueEmailIndexes) {
      if (idx.name !== keepName) {
        await collection.dropIndex(idx.name);
      }
    }
  } catch (err) {
    console.error('Email index setup failed:', err.message);
  }
};

/**
 * Disconnect from MongoDB
 */
const disconnectFromDatabase = async () => {
  connectionPromise = null;
  await mongoose.disconnect();
};

module.exports = {
    connectToDatabase,
    disconnectFromDatabase,
};