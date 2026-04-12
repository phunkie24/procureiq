const router = require('express').Router()
const mock = require('../services/MockDataService')
router.get('/', (req, res) => res.json({ data: mock.PURCHASE_ORDERS, total: mock.PURCHASE_ORDERS.length }))
router.get('/:id', (req, res) => {
  const po = mock.PURCHASE_ORDERS.find(p => p._id === req.params.id)
  if (!po) return res.status(404).json({ error: 'PO not found' })
  res.json(po)
})
router.post('/', (req, res) => res.status(201).json({ success: true, message: 'PO creation queued' }))
module.exports = router
