const router = require('express').Router()
const mock = require('../services/MockDataService')
router.get('/', (req, res) => {
  const pending = mock.HITL_QUEUE.filter(h => h.status === 'pending')
  res.json({ data: pending, total: pending.length })
})
router.post('/:id/resolve', (req, res) => {
  const item = mock.HITL_QUEUE.find(h => h._id === req.params.id)
  if (item) { item.status = req.body.approved ? 'approved' : 'rejected'; item.resolvedAt = new Date() }
  const io = req.app.get('io')
  io?.emit('hitl:resolved', { id: req.params.id, approved: req.body.approved, resolvedAt: new Date().toISOString() })
  res.json({ success: true, approved: req.body.approved })
})
module.exports = router
