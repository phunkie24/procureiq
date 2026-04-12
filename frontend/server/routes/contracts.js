const router = require('express').Router()
const mock = require('../services/MockDataService')
router.get('/', (req, res) => res.json({ data: mock.CONTRACTS, total: mock.CONTRACTS.length }))
router.get('/:id', (req, res) => {
  const c = mock.CONTRACTS.find(c => c._id === req.params.id)
  if (!c) return res.status(404).json({ error: 'Contract not found' })
  res.json(c)
})
router.post('/monitor', (req, res) => {
  const io = req.app.get('io')
  io?.emit('agent:event', { agentId: 'agent_1_4_contract', agentLabel: 'Contract 1.4', message: 'Manual contract monitoring cycle triggered', isAuto: false, timestamp: new Date().toISOString() })
  res.json({ success: true, message: 'Monitoring triggered', contractsQueued: mock.CONTRACTS.length })
})
router.post('/:id/amend', (req, res) => res.json({ success: true, message: 'Amendment drafted', requiresHuman: true }))
module.exports = router
