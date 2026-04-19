const router = require('express').Router()
const mongoose = require('mongoose')

const col = () => mongoose.connection.db.collection('contracts')

router.get('/', async (req, res) => {
  const contracts = await col().find({}).sort({ createdAt: -1 }).toArray()
  res.json({ data: contracts, total: contracts.length })
})

router.get('/:id', async (req, res) => {
  const c = await col().findOne({ _id: req.params.id })
  if (!c) return res.status(404).json({ error: 'Contract not found' })
  res.json(c)
})

router.post('/monitor', async (req, res) => {
  const io = req.app.get('io')
  io?.emit('agent:event', {
    agentId: 'agent_1_4_contract',
    message: 'Manual contract monitoring cycle triggered',
    isAuto: false,
    timestamp: new Date().toISOString(),
  })
  const count = await col().countDocuments()
  res.json({ success: true, message: 'Monitoring triggered', contractsQueued: count })
})

router.post('/:id/amend', (req, res) => res.json({ success: true, message: 'Amendment drafted', requiresHuman: true }))

module.exports = router
