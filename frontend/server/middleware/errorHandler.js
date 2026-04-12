// middleware/errorHandler.js
const logger = require('../config/logger')

function errorHandler(err, req, res, next) {
  logger.error(`${req.method} ${req.path} — ${err.message}`, { stack: err.stack })

  if (err.name === 'ValidationError') {
    return res.status(400).json({ error: 'Validation failed', details: err.errors })
  }
  if (err.name === 'CastError') {
    return res.status(400).json({ error: 'Invalid ID format' })
  }
  if (err.code === 11000) {
    return res.status(409).json({ error: 'Duplicate entry' })
  }
  if (err.status) {
    return res.status(err.status).json({ error: err.message })
  }

  res.status(500).json({
    error: process.env.NODE_ENV === 'production' ? 'Internal server error' : err.message,
  })
}

module.exports = { errorHandler }
