const mongoose = require('mongoose')
const logger = require('./logger')

async function connectDB() {
  const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/procureiq'
  try {
    await mongoose.connect(uri, {
      serverSelectionTimeoutMS: 5000,
    })
    logger.info(`MongoDB connected: ${mongoose.connection.host}`)

    mongoose.connection.on('error', (err) => logger.error('MongoDB error:', err))
    mongoose.connection.on('disconnected', () => logger.warn('MongoDB disconnected'))
  } catch (err) {
    logger.warn(`MongoDB unavailable (${err.message}) — running with in-memory mock data`)
    // App continues without DB — routes fall back to mock data
  }
}

module.exports = connectDB
