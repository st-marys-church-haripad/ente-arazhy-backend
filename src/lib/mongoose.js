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

const connectToDatabase = async () => {
    try {
        await mongoose.connect(config.MONGO_URI, clientOptions);
        // Ensure indexes that can be brittle across deployments
        await ensureEmailIndex();
    } catch (error) {
        // console.error('Error connecting to MongoDB:', error);
        throw error;
    }
};

// Drop legacy email index and recreate a partial, sparse unique index so
// missing/empty emails do not collide. Index errors are logged but do not
// prevent server start.
const ensureEmailIndex = async () => {
    try {
        const collection = mongoose.connection.collection('users');
        // Drop any existing email index by name if present
        const indexes = await collection.indexes();
        const emailIndex = indexes.find(idx => idx.key && idx.key.email === 1);
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
    } catch (err) {
        // Log and continue; avoids blocking app start on index issues
        console.error('Warning: unable to ensure email index', err.message);
    }
};

const disconnectFromDatabase = async () => {
    try {
        await mongoose.disconnect();    
        // console.log('Disconnected from MongoDB successfully');
    } catch (error) {
        // console.error('Error disconnecting from MongoDB:', error);
        throw error;
    }
};

module.exports = {
    connectToDatabase,
    disconnectFromDatabase,
};