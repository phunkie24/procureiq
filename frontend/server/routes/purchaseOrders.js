const router = require('express').Router()
const mongoose = require('mongoose')

const col = () => mongoose.connection.db.collection('purchaseorders')

router.get('/', async (req, res) => {
  const query = {}
  if (req.query.status) query.status = req.query.status
  const pos = await col().find(query).sort({ createdAt: -1 }).toArray()
  res.json({ data: pos, total: pos.length })
})

router.get('/:id', async (req, res) => {
  const po = await col().findOne({ _id: req.params.id })
  if (!po) return res.status(404).json({ error: 'PO not found' })
  res.json(po)
})

router.post('/', async (req, res) => {
  const po = { _id: require('uuid').v4(), ...req.body, status: 'pending', createdAt: new Date() }
  await col().insertOne(po)
  res.status(201).json({ success: true, message: 'PO created', po })
})

module.exports = router
