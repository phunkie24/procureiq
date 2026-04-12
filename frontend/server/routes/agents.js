const router = require('express').Router()
const mock = require('../services/MockDataService')

const AGENT_INFO = [
  { id: 'agent_1_1_sourcing', name: 'Sourcing Intelligence Agent 1.1', description: 'Monitors inventory, triggers RFQs, pre-qualifies vendors. Autonomous below ₦50M.', patterns: ['Planning','Tool Use','Parallelization','Memory','RAG'], color: '#3b82f6' },
  { id: 'agent_1_2_bid_eval', name: 'Bid Evaluation & Award Agent 1.2', description: 'Multi-criteria bid scoring, compliance validation, auto-awards below ₦100M.', patterns: ['Parallelization','Reflection','CoT Reasoning','Guardrails'], color: '#8b5cf6' },
  { id: 'agent_1_3_po_exec', name: 'PO Execution Agent 1.3', description: 'Three-way matching, ERP write operations, vendor PO transmission.', patterns: ['Tool Use','Exception Handling','Idempotency'], color: '#10b981' },
  { id: 'agent_1_4_contract', name: 'Contract Intelligence Agent 1.4', description: 'NLP risk scoring, expiry monitoring, autonomous amendment drafting.', patterns: ['Goal Setting','RAG','Exploration','Planning'], color: '#f97316' },
  { id: 'agent_1_5_vendor_mgmt', name: 'Vendor Management Agent 1.5', description: 'Performance scorecards, sentiment analysis, market vendor discovery.', patterns: ['Exploration','Memory','Parallelization','Learning'], color: '#ec4899' },
]

router.get('/', (req, res) => {
  const agents = AGENT_INFO.map((info, i) => ({
    ...info,
    ...mock.AGENT_METRICS[i],
  }))
  res.json(agents)
})

router.get('/:id', (req, res) => {
  const info = AGENT_INFO.find(a => a.id === req.params.id)
  const metrics = mock.AGENT_METRICS.find(m => m.agentId === req.params.id)
  if (!info) return res.status(404).json({ error: 'Agent not found' })
  res.json({ ...info, ...metrics })
})

router.get('/:id/metrics', (req, res) => {
  const metrics = mock.AGENT_METRICS.find(m => m.agentId === req.params.id)
  if (!metrics) return res.status(404).json({ error: 'Metrics not found' })
  res.json(metrics)
})

router.post('/:id/tasks', (req, res) => {
  const io = req.app.get('io')
  const { task, payload } = req.body
  io?.emit('agent:event', {
    agentId: req.params.id,
    agentLabel: req.params.id,
    message: `Manual task triggered: ${task}`,
    isAuto: false,
    timestamp: new Date().toISOString(),
  })
  res.json({ success: true, message: 'Task queued', traceId: require('uuid').v4() })
})

module.exports = router
