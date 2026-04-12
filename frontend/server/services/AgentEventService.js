/**
 * services/AgentEventService.js
 * Simulates real-time agent events via Socket.io.
 * In production, the Python agent squadron publishes real events here.
 */
const logger = require('../config/logger')

const AGENT_EVENTS = [
  { agentId: 'agent_1_1_sourcing', agentLabel: 'Sourcing 1.1', message: 'RFQ-2025-0143 triggered — mechanical reorder at CC-2000', isAuto: true, entityType: 'RFQ' },
  { agentId: 'agent_1_2_bid_eval', agentLabel: 'Bid Eval 1.2', message: 'BID-2025-0392 scored 88.7 — 2nd of 6, evaluation continues', isAuto: true, entityType: 'Bid' },
  { agentId: 'agent_1_3_po_exec', agentLabel: 'PO Exec 1.3', message: 'Three-way match verified: RFQ-0140 ↔ QTE-0893 ↔ CTR-0033', isAuto: true, entityType: 'PO' },
  { agentId: 'agent_1_4_contract', agentLabel: 'Contract 1.4', message: 'CTR-2025-0029 SLA score Q2: 94.2/100 — exceeds target', isAuto: true, entityType: 'Contract' },
  { agentId: 'agent_1_5_vendor_mgmt', agentLabel: 'Vendor Mgmt 1.5', message: 'Sentiment analysis: Coastal Supplies — positive trend, partnership opportunity flagged', isAuto: true, entityType: 'Vendor' },
  { agentId: 'orchestrator', agentLabel: 'Orchestrator', message: 'Task queued: discover_vendors category=subsea priority=HIGH', isAuto: false, entityType: 'System' },
  { agentId: 'agent_1_1_sourcing', agentLabel: 'Sourcing 1.1', message: 'Vendor pre-qualification complete: 3/5 candidates passed NC threshold', isAuto: true, entityType: 'RFQ' },
  { agentId: 'agent_1_2_bid_eval', agentLabel: 'Bid Eval 1.2', message: 'Compliance check: Delta Oilfield — DPR registered ✓, NCDMB compliant ✓', isAuto: true, entityType: 'Bid' },
  { agentId: 'agent_1_3_po_exec', agentLabel: 'PO Exec 1.3', message: 'Budget reserved CC-1000: ₦15.2M for RFQ-2025-0141', isAuto: true, entityType: 'PO' },
  { agentId: 'agent_1_4_contract', agentLabel: 'Contract 1.4', message: 'Amendment CTR-0031 drafted: rate escalation 3.2% per CPI formula', isAuto: true, entityType: 'Contract' },
]

let eventIndex = 0

function startSimulation(io) {
  logger.info('AgentEventService: starting real-time event simulation')

  setInterval(() => {
    const event = AGENT_EVENTS[eventIndex % AGENT_EVENTS.length]
    const payload = {
      ...event,
      time: new Date().toTimeString().slice(0, 8),
      timestamp: new Date().toISOString(),
      traceId: require('uuid').v4(),
    }
    io.emit('agent:event', payload)
    logger.debug(`Emitted agent:event — ${event.agentId}`)
    eventIndex++
  }, 4500)

  // Occasionally emit HITL events
  setInterval(() => {
    if (Math.random() < 0.3) {
      io.emit('hitl:new', {
        _id: require('uuid').v4(),
        requestingAgent: 'agent_1_2_bid_eval',
        decisionType: 'award',
        contextSummary: 'New bid evaluation requires human review',
        estimatedValue: Math.round(Math.random() * 900000000 + 100000000),
        priority: Math.random() > 0.5 ? 'high' : 'medium',
        status: 'pending',
        createdAt: new Date().toISOString(),
      })
    }
  }, 30000)
}

module.exports = { startSimulation }
