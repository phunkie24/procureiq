const express = require('express')
const cors = require('cors')
const helmet = require('helmet')
const morgan = require('morgan')
const { createServer } = require('http')
const { Server } = require('socket.io')
require('express-async-errors')
require('dotenv').config()

const connectDB = require('./config/db')
const logger = require('./config/logger')
const { errorHandler } = require('./middleware/errorHandler')
const { rateLimiter } = require('./middleware/rateLimiter')

// Routes
const dashboardRoutes = require('./routes/dashboard')
const agentRoutes = require('./routes/agents')
const rfqRoutes = require('./routes/rfqs')
const bidRoutes = require('./routes/bids')
const poRoutes = require('./routes/purchaseOrders')
const contractRoutes = require('./routes/contracts')
const vendorRoutes = require('./routes/vendors')
const hitlRoutes = require('./routes/hitl')
const auditRoutes = require('./routes/audit')

const AgentEventService = require('./services/AgentEventService')

const app = express()
const httpServer = createServer(app)

// ── Socket.io ──────────────────────────────────────────────
const io = new Server(httpServer, {
  cors: { origin: process.env.CLIENT_URL || 'http://localhost:3000', methods: ['GET', 'POST'] },
})

// Attach io to app so routes/services can emit
app.set('io', io)

io.on('connection', (socket) => {
  logger.info(`Socket connected: ${socket.id}`)
  socket.on('disconnect', () => logger.info(`Socket disconnected: ${socket.id}`))
  socket.on('hitl:resolve', (data) => io.emit('hitl:resolved', data))
})

// ── Middleware ─────────────────────────────────────────────
app.use(helmet({ contentSecurityPolicy: false }))
app.use(cors({ origin: process.env.CLIENT_URL || 'http://localhost:3000', credentials: true }))
app.use(express.json({ limit: '10mb' }))
app.use(morgan('combined', { stream: { write: (msg) => logger.http(msg.trim()) } }))
app.use('/api', rateLimiter)

// ── Routes ─────────────────────────────────────────────────
app.use('/api/dashboard', dashboardRoutes)
app.use('/api/agents', agentRoutes)
app.use('/api/rfqs', rfqRoutes)
app.use('/api/bids', bidRoutes)
app.use('/api/purchase-orders', poRoutes)
app.use('/api/contracts', contractRoutes)
app.use('/api/vendors', vendorRoutes)
app.use('/api/hitl', hitlRoutes)
app.use('/api/audit', auditRoutes)

// Health check
app.get('/api/health', (req, res) => res.json({ status: 'ok', timestamp: new Date() }))

// ── Error handler ──────────────────────────────────────────
app.use(errorHandler)

// ── Start ──────────────────────────────────────────────────
const PORT = process.env.PORT || 5000

async function start() {
  await connectDB()
  httpServer.listen(PORT, () => {
    logger.info(`Server running on port ${PORT}`)
    // Start agent event simulation
    AgentEventService.startSimulation(io)
  })
}

start().catch((err) => {
  logger.error('Failed to start server:', err)
  process.exit(1)
})

module.exports = { app, io }
