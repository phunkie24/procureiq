const router = require('express').Router()
const mongoose = require('mongoose')

const col = () => mongoose.connection.db.collection('audits')

router.get('/', async (req, res) => {
  const query = {}
  if (req.query.agentId) query.agentId = req.query.agentId
  if (req.query.isAuto !== undefined) query.isAuto = req.query.isAuto === 'true'
  const page  = parseInt(req.query.page)  || 1
  const limit = parseInt(req.query.limit) || 20
  const total = await col().countDocuments(query)
  const data  = await col().find(query).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).toArray()
  res.json({ data, total, page, limit })
})

module.exports = router
