const router = require('express').Router()
const mock = require('../services/MockDataService')
const { v4: uuidv4 } = require('uuid')

router.get('/:id/bids', (req, res) => {
  const bids = mock.BIDS.filter(b => b.rfqId === req.params.id)
  res.json({ data: bids, total: bids.length })
})

router.post('/:id/evaluate', (req, res) => {
  const rfq = mock.RFQS.find(r => r._id === req.params.id)
  if (!rfq) return res.status(404).json({ error: 'RFQ not found' })
  rfq.status = 'evaluating'
  const io = req.app.get('io')
  io?.emit('agent:event', { agentId: 'agent_1_2_bid_eval', agentLabel: 'Bid Eval 1.2', message: `Bid evaluation triggered for ${rfq.rfqNumber}`, isAuto: false, timestamp: new Date().toISOString() })
  const bids = mock.BIDS.filter(b => b.rfqId === req.params.id)
  res.json({ success: true, rfqId: req.params.id, bidsEvaluated: bids.length })
})

router.get('/', (req, res) => {
  let rfqs = [...mock.RFQS]
  if (req.query.status) rfqs = rfqs.filter(r => r.status === req.query.status)
  if (req.query.category) rfqs = rfqs.filter(r => r.category === req.query.category)
  res.json({ data: rfqs, total: rfqs.length })
})

router.get('/:id', (req, res) => {
  const rfq = mock.RFQS.find(r => r._id === req.params.id || r.rfqNumber === req.params.id)
  if (!rfq) return res.status(404).json({ error: 'RFQ not found' })
  res.json(rfq)
})

router.post('/', (req, res) => {
  const rfq = {
    _id: uuidv4(),
    rfqNumber: `RFQ-2025-${String(mock.RFQS.length + 143).padStart(4,'0')}`,
    ...req.body,
    status: 'draft',
    autonomyLevel: 'autonomous',
    traceId: uuidv4(),
    createdAt: new Date(),
  }
  mock.RFQS.push(rfq)
  const io = req.app.get('io')
  io?.emit('agent:event', { agentId: 'agent_1_1_sourcing', agentLabel: 'Sourcing 1.1', message: `RFQ ${rfq.rfqNumber} created for ${rfq.category}`, isAuto: false, timestamp: new Date().toISOString() })
  res.status(201).json(rfq)
})

router.post('/:id/issue', (req, res) => {
  const rfq = mock.RFQS.find(r => r._id === req.params.id)
  if (!rfq) return res.status(404).json({ error: 'RFQ not found' })
  rfq.status = 'issued'
  rfq.issuedAt = new Date()
  res.json({ success: true, rfq })
})

module.exports = router
