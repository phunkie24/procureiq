const router = require('express').Router()
const mongoose = require('mongoose')
const { v4: uuidv4 } = require('uuid')

const col = () => mongoose.connection.db.collection('agentmetrics')

const AGENT_INFO = [
  { id: 'agent_1_1_sourcing',  name: 'Sourcing Intelligence Agent 1',  description: 'Monitors inventory, triggers RFQs, pre-qualifies vendors. Autonomous below ₦50M.',  patterns: ['Planning','Tool Use','Parallelization','Memory','RAG'], color: '#3b82f6' },
  { id: 'agent_1_2_bid_eval',  name: 'Bid Evaluation & Award Agent 2', description: 'Multi-criteria bid scoring, compliance validation, auto-awards below ₦100M.', patterns: ['Parallelization','Reflection','CoT Reasoning','Guardrails'], color: '#8b5cf6' },
  { id: 'agent_1_3_po_exec',   name: 'PO Execution Agent 3',           description: 'Three-way matching, ERP write operations, vendor PO transmission.',                patterns: ['Tool Use','Exception Handling','Idempotency'], color: '#10b981' },
  { id: 'agent_1_4_contract',  name: 'Contract Intelligence Agent 4',  description: 'NLP risk scoring, expiry monitoring, autonomous amendment drafting.',               patterns: ['Goal Setting','RAG','Exploration','Planning'], color: '#f97316' },
  { id: 'agent_1_5_vendor_mgmt', name: 'Vendor Management Agent 5',    description: 'Performance scorecards, sentiment analysis, market vendor discovery.',              patterns: ['Exploration','Memory','Parallelization','Learning'], color: '#ec4899' },
]

router.get('/', async (req, res) => {
  const metrics = await col().find({}).toArray()
  const agents = AGENT_INFO.map(info => {
    const m = metrics.find(m => m.agentId === info.id) || {}
    return { ...info, ...m }
  })
  res.json(agents)
})

router.get('/:id', async (req, res) => {
  const info = AGENT_INFO.find(a => a.id === req.params.id)
  if (!info) return res.status(404).json({ error: 'Agent not found' })
  const metrics = await col().findOne({ agentId: req.params.id }) || {}
  res.json({ ...info, ...metrics })
})

router.get('/:id/metrics', async (req, res) => {
  const metrics = await col().findOne({ agentId: req.params.id })
  if (!metrics) return res.status(404).json({ error: 'Metrics not found' })
  res.json(metrics)
})

router.post('/:id/tasks', (req, res) => {
  const io = req.app.get('io')
  const { task } = req.body
  io?.emit('agent:event', {
    agentId: req.params.id,
    message: `Manual task triggered: ${task}`,
    isAuto: false,
    timestamp: new Date().toISOString(),
  })
  res.json({ success: true, message: 'Task queued', traceId: uuidv4() })
})

module.exports = router
