const router = require('express').Router()
const mongoose = require('mongoose')

const col = () => mongoose.connection.db.collection('hitls')
const auditCol = () => mongoose.connection.db.collection('audits')

router.get('/', async (req, res) => {
  const query = {}
  if (req.query.type === 'hitl') {
    const log = await auditCol().find({ isAuto: false }).sort({ createdAt: -1 }).toArray()
    return res.json({ data: log, total: log.length })
  }
  const pending = await col().find({ status: 'pending' }).sort({ createdAt: -1 }).toArray()
  res.json({ data: pending, total: pending.length })
})

router.post('/:id/resolve', async (req, res) => {
  const status = req.body.approved ? 'approved' : 'rejected'
  await col().updateOne(
    { _id: req.params.id },
    { $set: { status, resolvedAt: new Date(), resolution: req.body.notes || '' } }
  )
  const io = req.app.get('io')
  io?.emit('hitl:resolved', { id: req.params.id, approved: req.body.approved, resolvedAt: new Date().toISOString() })
  res.json({ success: true, approved: req.body.approved })
})

module.exports = router
