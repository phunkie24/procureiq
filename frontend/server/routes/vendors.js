const router = require('express').Router()
const mongoose = require('mongoose')
const { v4: uuidv4 } = require('uuid')

const col = () => mongoose.connection.db.collection('vendors')

router.get('/', async (req, res) => {
  const query = {}
  if (req.query.status) query.status = req.query.status
  const vendors = await col().find(query).toArray()
  res.json({ data: vendors, total: vendors.length })
})

router.get('/:id', async (req, res) => {
  const v = await col().findOne({ _id: req.params.id })
  if (!v) return res.status(404).json({ error: 'Vendor not found' })
  res.json(v)
})

router.get('/:id/scorecard', (req, res) => res.json({
  vendorId: req.params.id,
  period: req.query.period || '2025-Q2',
  overallScore: Math.round(60 + Math.random() * 35),
  deliveryScore: Math.round(65 + Math.random() * 30),
  qualityScore: Math.round(60 + Math.random() * 35),
}))

router.post('/discover', (req, res) => {
  const io = req.app.get('io')
  io?.emit('agent:event', {
    agentId: 'agent_1_5_vendor_mgmt',
    message: `Market discovery triggered for category: ${req.body.category}`,
    isAuto: false,
    timestamp: new Date().toISOString(),
  })
  res.json({ success: true, message: 'Discovery task queued', category: req.body.category })
})

router.post('/onboard', async (req, res) => {
  const vendor = {
    _id: uuidv4(),
    ...req.body,
    status: 'active',
    createdAt: new Date(),
  }
  await col().insertOne(vendor)
  res.status(201).json({ success: true, message: 'Onboarding workflow started', traceId: uuidv4(), vendor })
})

module.exports = router
