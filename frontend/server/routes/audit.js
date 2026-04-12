const router = require('express').Router()
const mock = require('../services/MockDataService')
router.get('/', (req, res) => {
  let log = [...mock.AUDIT_LOG]
  if (req.query.agentId) log = log.filter(e => e.agentId === req.query.agentId)
  if (req.query.isAuto !== undefined) log = log.filter(e => e.isAuto === (req.query.isAuto === 'true'))
  const page = parseInt(req.query.page) || 1
  const limit = parseInt(req.query.limit) || 20
  res.json({ data: log.slice((page-1)*limit, page*limit), total: log.length, page, limit })
})
module.exports = router
