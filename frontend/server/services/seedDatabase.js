/**
 * seedDatabase.js
 * Seeds all MongoDB collections from MockDataService on first startup.
 * Uses raw collection API to preserve string _ids and skip ObjectId validation.
 */
const mongoose = require('mongoose')
const logger = require('../config/logger')
const {
  VENDORS, RFQS, BIDS, PURCHASE_ORDERS,
  CONTRACTS, HITL_QUEUE, AUDIT_LOG, AGENT_METRICS,
} = require('./MockDataService')

const SEEDS = [
  { name: 'vendors',       data: VENDORS },
  { name: 'rfqs',          data: RFQS },
  { name: 'bids',          data: BIDS },
  { name: 'purchaseorders',data: PURCHASE_ORDERS },
  { name: 'contracts',     data: CONTRACTS },
  { name: 'hitls',         data: HITL_QUEUE },
  { name: 'audits',        data: AUDIT_LOG },
  { name: 'agentmetrics',  data: AGENT_METRICS },
]

async function seedDatabase() {
  const db = mongoose.connection.db
  for (const { name, data } of SEEDS) {
    const col = db.collection(name)
    const count = await col.countDocuments()
    if (count === 0) {
      await col.insertMany(data.map(d => ({ ...d })))
      logger.info(`Seeded ${data.length} docs → ${name}`)
    } else {
      logger.info(`Collection ${name} already has ${count} docs — skipping seed`)
    }
  }
}

module.exports = seedDatabase
