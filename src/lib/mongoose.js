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
};

/**
 * Connect to MongoDB
 */
const connectToDatabase = async () => {
  try {
    await mongoose.connect(config.MONGO_URI, clientOptions);
    await ensureEmailIndex();
  } catch (error) {
    throw error;
  }
};

/**
 * Ensure Email Index
 * Creates/recreates partial unique index for member emails
 */
const ensureEmailIndex = async () => {
  try {
    const collection = mongoose.connection.collection('members');
    const indexes = await collection.indexes();
    const emailIndex = indexes.find((idx) => idx.key && idx.key.email === 1);

    if (emailIndex && emailIndex.name) {
      await collection.dropIndex(emailIndex.name);
    }

    await collection.createIndex(
      { email: 1 },
      {
        unique: true,
        sparse: true,
        partialFilterExpression: { email: { $exists: true, $nin: [null, ''] } }
      }
    );
  } catch (_err) {
  }
};

/**
 * Disconnect from MongoDB
 */
const disconnectFromDatabase = async () => {
  try {
    await mongoose.disconnect();
  } catch (error) {
    throw error;
  }
};

module.exports = {
    connectToDatabase,
    disconnectFromDatabase,
};