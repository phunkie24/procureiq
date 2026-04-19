const router = require('express').Router()
const mongoose = require('mongoose')

router.get('/stats', async (req, res) => {
  const hitlPending = await mongoose.connection.db.collection('hitls').countDocuments({ status: 'pending' })
  res.json({
    rfqsInitiated: 142,
    bidsReceived: 387,
    awardsMade: 118,
    posIssued: 104,
    completed: 89,
    totalSpendNGN: 41500000000,
    hitlPending,
    agentsActive: 5,
    nigerianContentAvg: 75,
  })
})

router.get('/pipeline', (req, res) => {
  res.json([
    { name: 'Jan', rfqs: 18, awards: 14, pos: 12 },
    { name: 'Feb', rfqs: 22, awards: 17, pos: 15 },
    { name: 'Mar', rfqs: 28, awards: 21, pos: 19 },
    { name: 'Apr', rfqs: 25, awards: 19, pos: 17 },
    { name: 'May', rfqs: 32, awards: 24, pos: 22 },
    { name: 'Jun', rfqs: 29, awards: 22, pos: 20 },
    { name: 'Jul', rfqs: 35, awards: 27, pos: 24 },
  ])
})

router.get('/spend', (req, res) => {
  res.json([
    { name: 'Jan', capex: 3.2, opex: 1.1, services: 0.4 },
    { name: 'Feb', capex: 4.1, opex: 1.3, services: 0.5 },
    { name: 'Mar', capex: 5.8, opex: 1.6, services: 0.6 },
    { name: 'Apr', capex: 6.2, opex: 1.8, services: 0.7 },
    { name: 'May', capex: 7.1, opex: 1.4, services: 0.8 },
    { name: 'Jun', capex: 6.8, opex: 1.9, services: 0.7 },
    { name: 'Jul', capex: 7.9, opex: 2.1, services: 0.9 },
  ])
})

module.exports = router
