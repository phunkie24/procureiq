const router = require('express').Router()
const mongoose = require('mongoose')
const { v4: uuidv4 } = require('uuid')

const col = () => mongoose.connection.db.collection('rfqs')
const bidsCol = () => mongoose.connection.db.collection('bids')

router.get('/', async (req, res) => {
  const query = {}
  if (req.query.status) query.status = req.query.status
  if (req.query.category) query.category = req.query.category
  const rfqs = await col().find(query).sort({ createdAt: -1 }).toArray()
  res.json({ data: rfqs, total: rfqs.length })
})

router.get('/:id', async (req, res) => {
  const rfq = await col().findOne({ $or: [{ _id: req.params.id }, { rfqNumber: req.params.id }] })
  if (!rfq) return res.status(404).json({ error: 'RFQ not found' })
  res.json(rfq)
})

router.get('/:id/bids', async (req, res) => {
  const bids = await bidsCol().find({ rfqId: req.params.id }).toArray()
  res.json({ data: bids, total: bids.length })
})

router.post('/', async (req, res) => {
  const count = await col().countDocuments()
  const rfq = {
    _id: uuidv4(),
    rfqNumber: `RFQ-2025-${String(count + 143).padStart(4, '0')}`,
    ...req.body,
    status: 'draft',
    autonomyLevel: 'autonomous',
    traceId: uuidv4(),
    createdAt: new Date(),
  }
  await col().insertOne(rfq)
  const io = req.app.get('io')
  io?.emit('agent:event', {
    agentId: 'agent_1_1_sourcing',
    message: `RFQ ${rfq.rfqNumber} created for ${rfq.category}`,
    isAuto: false,
    timestamp: new Date().toISOString(),
  })
  res.status(201).json(rfq)
})

router.post('/:id/issue', async (req, res) => {
  await col().updateOne({ _id: req.params.id }, { $set: { status: 'issued', issuedAt: new Date() } })
  const rfq = await col().findOne({ _id: req.params.id })
  res.json({ success: true, rfq })
})

router.post('/:id/evaluate', async (req, res) => {
  const rfq = await col().findOne({ _id: req.params.id })
  if (!rfq) return res.status(404).json({ error: 'RFQ not found' })
  await col().updateOne({ _id: req.params.id }, { $set: { status: 'evaluating' } })
  const io = req.app.get('io')
  io?.emit('agent:event', {
    agentId: 'agent_1_2_bid_eval',
    message: `Bid evaluation triggered for ${rfq.rfqNumber}`,
    isAuto: false,
    timestamp: new Date().toISOString(),
  })
  const bids = await bidsCol().find({ rfqId: req.params.id }).toArray()
  res.json({ success: true, rfqId: req.params.id, bidsEvaluated: bids.length })
})

module.exports = router
