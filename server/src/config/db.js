const mongoose = require('mongoose');

/**
 * Connect to MongoDB instance with safe logging and explicit database configuration
 */
const connectDB = async () => {
  if (mongoose.connection.readyState === 1) {
    return mongoose.connection;
  }
  if (mongoose.connection.readyState === 2) {
    await new Promise((resolve) => mongoose.connection.once('connected', resolve));
    return mongoose.connection;
  }

  const uri = process.env.MONGO_URI || process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/appointease';

  // Safe URI representation without credentials for logging/debugging
  const safeUri = uri.replace(/\/\/([^:@]+):([^@]+)@/, '//***:***@');

  try {
    const conn = await mongoose.connect(uri, {
      dbName: 'appointease', // Strictly target appointease database
      serverSelectionTimeoutMS: 10000,
      connectTimeoutMS: 10000,
      socketTimeoutMS: 45000,
      maxPoolSize: 10,
      minPoolSize: 2,
      retryWrites: true,
      retryReads: true
    });

    console.log('MongoDB connected');
    console.log(`Database: ${conn.connection.name}`);
    return conn;
  } catch (error) {
    console.error(`[Database Error] Failed to connect to MongoDB (${safeUri}): ${error.message}`);
    
    // Fallback to local MongoDB instance if remote Atlas fails (only in development)
    const localUri = 'mongodb://127.0.0.1:27017/appointease';
    if (uri !== localUri && process.env.NODE_ENV !== 'production') {
      console.log('[Database] Attempting fallback to local MongoDB replica set (127.0.0.1:27017)...');
      try {
        await mongoose.disconnect();
        const localConn = await mongoose.connect(localUri, {
          dbName: 'appointease',
          serverSelectionTimeoutMS: 3000,
        });
        console.log('MongoDB connected (fallback)');
        console.log(`Database: ${localConn.connection.name}`);
        return localConn;
      } catch (localError) {
        console.error(`[Database Error] Fallback to local MongoDB failed: ${localError.message}`);
      }
    }
    return null;
  }
};

/**
 * Map mongoose readyState to status object
 */
const getDatabaseStatus = () => {
  const stateMap = {
    0: 'disconnected',
    1: 'connected',
    2: 'connecting',
    3: 'disconnecting',
    99: 'uninitialized'
  };

  const stateCode = mongoose.connection.readyState;
  return {
    state: stateMap[stateCode] || 'unknown',
    code: stateCode,
    isConnected: stateCode === 1,
    name: mongoose.connection.name || 'appointease'
  };
};

mongoose.connection.on('disconnected', () => {
  console.warn('[Database] MongoDB connection disconnected');
});

mongoose.connection.on('reconnected', () => {
  console.log('[Database] MongoDB connection re-established');
});

mongoose.connection.on('error', (err) => {
  console.error('[Database] MongoDB connection error:', err.message);
});

module.exports = {
  connectDB,
  getDatabaseStatus
};
