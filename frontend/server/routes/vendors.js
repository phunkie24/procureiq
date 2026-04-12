const router = require('express').Router()
const mock = require('../services/MockDataService')
const { v4: uuidv4 } = require('uuid')
router.get('/', (req, res) => {
  let vendors = [...mock.VENDORS]
  if (req.query.status) vendors = vendors.filter(v => v.status === req.query.status)
  res.json({ data: vendors, total: vendors.length })
})
router.get('/:id', (req, res) => {
  const v = mock.VENDORS.find(v => v._id === req.params.id)
  if (!v) return res.status(404).json({ error: 'Vendor not found' })
  res.json(v)
})
router.get('/:id/scorecard', (req, res) => res.json({ vendorId: req.params.id, period: req.query.period || '2025-Q2', overallScore: Math.round(60 + Math.random() * 35), deliveryScore: Math.round(65 + Math.random() * 30), qualityScore: Math.round(60 + Math.random() * 35) }))
router.post('/discover', (req, res) => {
  const io = req.app.get('io')
  io?.emit('agent:event', { agentId: 'agent_1_5_vendor_mgmt', agentLabel: 'Vendor Mgmt 1.5', message: `Market discovery triggered for category: ${req.body.category}`, isAuto: false, timestamp: new Date().toISOString() })
  res.json({ success: true, message: 'Discovery task queued', category: req.body.category })
})
router.post('/onboard', (req, res) => res.status(201).json({ success: true, message: 'Onboarding workflow started', traceId: uuidv4() }))
module.exports = router
