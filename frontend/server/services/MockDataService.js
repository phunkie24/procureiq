/**
 * services/MockDataService.js
 * In-memory mock data — used when MongoDB is not connected.
 * Mirrors the exact shape of the Mongoose models.
 */
const { v4: uuidv4 } = require('uuid')

const now = new Date()
const daysAgo = (n) => new Date(now - n * 86400000)
const daysLater = (n) => new Date(now.getTime() + n * 86400000)

const VENDORS = [
  { _id: 'v1', name: 'Coastal Supplies Ltd', vendorCode: 'V-0142', email: 'coastal@vendor.ng', categories: ['Mechanical'], nigerianContentPct: 78, financialStabilityScore: 8.2, performanceScore: 91, status: 'active', createdAt: daysAgo(180) },
  { _id: 'v2', name: 'Nigerinox Ltd', vendorCode: 'V-0089', email: 'nigerinox@vendor.ng', categories: ['Chemicals'], nigerianContentPct: 65, financialStabilityScore: 7.5, performanceScore: 87, status: 'active', createdAt: daysAgo(365) },
  { _id: 'v3', name: 'TechServ Nigeria', vendorCode: 'V-0234', email: 'techserv@vendor.ng', categories: ['IT'], nigerianContentPct: 45, financialStabilityScore: 5.1, performanceScore: 54, status: 'probation', createdAt: daysAgo(90) },
  { _id: 'v4', name: 'Delta Drillers', vendorCode: 'V-0178', email: 'delta@vendor.ng', categories: ['Drilling'], nigerianContentPct: 82, financialStabilityScore: 6.8, performanceScore: 72, status: 'active', createdAt: daysAgo(240) },
  { _id: 'v5', name: 'Zenith Oil Services', vendorCode: 'V-0056', email: 'zenith@vendor.ng', categories: ['Services'], nigerianContentPct: 91, financialStabilityScore: 9.1, performanceScore: 88, status: 'active', createdAt: daysAgo(500) },
]

const BIDS = [
  { _id: 'b1', rfqId: 'r1', vendorId: 'v1', vendorName: 'Coastal Supplies Ltd', totalPrice: 27800000, currency: 'NGN', deliveryDays: 14, qualityScore: 88, complianceScore: 95, nigerianContentPct: 78, compositeScore: 87.4, status: 'awarded', submittedAt: daysAgo(3) },
  { _id: 'b2', rfqId: 'r1', vendorId: 'v2', vendorName: 'Nigerinox Ltd', totalPrice: 29100000, currency: 'NGN', deliveryDays: 18, qualityScore: 82, complianceScore: 90, nigerianContentPct: 65, compositeScore: 83.1, status: 'rejected', submittedAt: daysAgo(3) },
  { _id: 'b3', rfqId: 'r1', vendorId: 'v4', vendorName: 'Delta Drillers', totalPrice: 31200000, currency: 'NGN', deliveryDays: 21, qualityScore: 79, complianceScore: 88, nigerianContentPct: 82, compositeScore: 80.6, status: 'rejected', submittedAt: daysAgo(2) },
  { _id: 'b4', rfqId: 'r4', vendorId: 'v1', vendorName: 'Coastal Supplies Ltd', totalPrice: 40500000, currency: 'NGN', deliveryDays: 10, qualityScore: 91, complianceScore: 97, nigerianContentPct: 78, compositeScore: 91.2, status: 'evaluating', submittedAt: daysAgo(1) },
  { _id: 'b5', rfqId: 'r4', vendorId: 'v4', vendorName: 'Delta Drillers', totalPrice: 38900000, currency: 'NGN', deliveryDays: 12, qualityScore: 85, complianceScore: 92, nigerianContentPct: 82, compositeScore: 88.7, status: 'evaluating', submittedAt: daysAgo(1) },
  { _id: 'b6', rfqId: 'r4', vendorId: 'v5', vendorName: 'Zenith Oil Services', totalPrice: 43200000, currency: 'NGN', deliveryDays: 8, qualityScore: 93, complianceScore: 98, nigerianContentPct: 91, compositeScore: 93.5, status: 'evaluating', submittedAt: daysAgo(0) },
]

const RFQS = [
  { _id: 'r1', rfqNumber: 'RFQ-2025-0142', title: 'Pump Seals & Gaskets', category: 'Mechanical', estimatedValue: 28500000, status: 'awarded', autonomyLevel: 'autonomous', issuedAt: daysAgo(5), submissionDeadline: daysLater(10), invitedVendors: ['v1','v2','v4'], traceId: uuidv4(), createdAt: daysAgo(5) },
  { _id: 'r2', rfqNumber: 'RFQ-2025-0141', title: 'Electrical Control Panels', category: 'Electrical', estimatedValue: 15200000, status: 'open', autonomyLevel: 'autonomous', issuedAt: daysAgo(3), submissionDeadline: daysLater(15), invitedVendors: ['v2','v5'], traceId: uuidv4(), createdAt: daysAgo(3) },
  { _id: 'r3', rfqNumber: 'RFQ-2025-0140', title: 'IT Equipment Refresh', category: 'IT', estimatedValue: 8300000, status: 'issued', autonomyLevel: 'autonomous', issuedAt: daysAgo(1), submissionDeadline: daysLater(20), invitedVendors: ['v3','v5'], traceId: uuidv4(), createdAt: daysAgo(1) },
  { _id: 'r4', rfqNumber: 'RFQ-2025-0139', title: 'Flow Station Maintenance Services', category: 'Services', estimatedValue: 42100000, status: 'evaluating', autonomyLevel: 'autonomous', issuedAt: daysAgo(8), submissionDeadline: daysLater(2), invitedVendors: ['v1','v4','v5'], traceId: uuidv4(), createdAt: daysAgo(8) },
]

const PURCHASE_ORDERS = [
  { _id: 'p1', poNumber: 'PO-2025-1041', vendorId: 'v5', rfqId: 'r1', totalValue: 28500000, currency: 'NGN', paymentTerms: 'NET30', status: 'issued', erpPoId: '4500123456', issuedAt: daysAgo(2), createdAt: daysAgo(2) },
  { _id: 'p2', poNumber: 'PO-2025-1042', vendorId: 'v1', rfqId: 'r4', totalValue: 482000000, currency: 'NGN', paymentTerms: 'NET60', status: 'pending', createdAt: daysAgo(0) },
  { _id: 'p3', poNumber: 'PO-2025-1040', vendorId: 'v2', totalValue: 67400000, currency: 'NGN', paymentTerms: 'NET30', status: 'acknowledged', erpPoId: '4500123440', issuedAt: daysAgo(5), createdAt: daysAgo(5) },
]

const CONTRACTS = [
  { _id: 'c1', contractNumber: 'CTR-2025-0034', vendorId: 'v3', title: 'IT Support Services', scope: 'Managed IT support across all facilities', startDate: daysAgo(180), endDate: daysLater(28), totalValue: 1200000000, status: 'expiring', nlpRiskScore: 7.2, unfavorableClauses: ['Unlimited liability clause', 'No force majeure'], createdAt: daysAgo(180) },
  { _id: 'c2', contractNumber: 'CTR-2025-0033', vendorId: 'v1', title: 'Mechanical Supplies Framework', scope: 'Supply of mechanical parts and consumables', startDate: daysAgo(90), endDate: daysLater(45), totalValue: 440000000, status: 'active', nlpRiskScore: 2.1, unfavorableClauses: [], createdAt: daysAgo(90) },
  { _id: 'c3', contractNumber: 'CTR-2025-0031', vendorId: 'v4', title: 'Drilling Services Contract', scope: 'Directional drilling and completion services', startDate: daysAgo(60), endDate: daysLater(62), totalValue: 890000000, status: 'active', nlpRiskScore: 4.5, unfavorableClauses: ['Non-standard payment terms'], createdAt: daysAgo(60) },
  { _id: 'c4', contractNumber: 'CTR-2025-0029', vendorId: 'v5', title: 'Operations & Maintenance', scope: 'Comprehensive O&M services for flow stations', startDate: daysAgo(30), endDate: daysLater(183), totalValue: 2100000000, status: 'active', nlpRiskScore: 1.8, unfavorableClauses: [], createdAt: daysAgo(30) },
]

const HITL_QUEUE = [
  { _id: 'h1', requestingAgent: 'agent_1_2_bid_eval', decisionType: 'award', contextSummary: 'Sole-source award recommendation for Shell Nigeria Logistics', recommendedAction: 'Approve award and issue PO', entityType: 'Award', entityId: 'AWD-2025-0119', estimatedValue: 680000000, status: 'pending', priority: 'high', traceId: uuidv4(), createdAt: daysAgo(0) },
  { _id: 'h2', requestingAgent: 'agent_1_1_sourcing', decisionType: 'issue_rfq', contextSummary: 'Strategic sourcing RFQ for subsea equipment lease exceeds threshold', recommendedAction: 'Review vendor list and approve issuance', entityType: 'RFQ', entityId: 'RFQ-2025-0143', estimatedValue: 1200000000, status: 'pending', priority: 'high', traceId: uuidv4(), createdAt: daysAgo(0) },
  { _id: 'h3', requestingAgent: 'agent_1_4_contract', decisionType: 'contract_termination', contextSummary: 'CTR-2025-0034 TechServ — persistent SLA breaches, 3 cure notices issued', recommendedAction: 'Approve termination and begin replacement sourcing', entityType: 'Contract', entityId: 'CTR-2025-0034', estimatedValue: 1200000000, status: 'pending', priority: 'medium', traceId: uuidv4(), createdAt: daysAgo(0) },
  { _id: 'h4', requestingAgent: 'agent_1_2_bid_eval', decisionType: 'award', contextSummary: 'First-time vendor Delta Oilfield Services bid for routine purchase', recommendedAction: 'Verify vendor credentials and approve if satisfactory', entityType: 'Award', entityId: 'AWD-2025-0120', estimatedValue: 45000000, status: 'pending', priority: 'medium', traceId: uuidv4(), createdAt: daysAgo(0) },
]

const AUDIT_LOG = [
  { _id: 'a1', agentId: 'agent_1_1_sourcing', action: 'RFQ-2025-0142 auto-issued to 6 vendors — value ₦28.5M', entityType: 'RFQ', autonomyLevel: 'autonomous', outcome: 'success', isAuto: true, traceId: uuidv4(), createdAt: new Date(now - 17 * 60000) },
  { _id: 'a2', agentId: 'agent_1_2_bid_eval', action: '18 bids scored for RFQ-0138 — winner: Nigerinox Ltd (87.4)', entityType: 'Bid', autonomyLevel: 'autonomous', outcome: 'success', isAuto: true, traceId: uuidv4(), createdAt: new Date(now - 18 * 60000) },
  { _id: 'a3', agentId: 'orchestrator', action: 'HITL raised: PO-2025-1042 (₦482M) — threshold exceeded', entityType: 'PO', autonomyLevel: 'human_required', outcome: 'escalated', isAuto: false, traceId: uuidv4(), createdAt: new Date(now - 20 * 60000) },
  { _id: 'a4', agentId: 'agent_1_3_po_exec', action: 'PO-2025-1041 issued to Zenith Oil — SAP doc 4500123456', entityType: 'PO', autonomyLevel: 'autonomous', outcome: 'success', isAuto: true, traceId: uuidv4(), createdAt: new Date(now - 21 * 60000) },
  { _id: 'a5', agentId: 'agent_1_4_contract', action: 'CTR-0034 NLP risk scan: 7.2/10 — unlimited liability detected', entityType: 'Contract', autonomyLevel: 'autonomous', outcome: 'success', isAuto: true, traceId: uuidv4(), createdAt: new Date(now - 24 * 60000) },
  { _id: 'a6', agentId: 'agent_1_5_vendor_mgmt', action: 'Q2 scorecards sent to 147 vendors — 8 flagged for probation', entityType: 'Vendor', autonomyLevel: 'autonomous', outcome: 'success', isAuto: true, traceId: uuidv4(), createdAt: new Date(now - 26 * 60000) },
  { _id: 'a7', agentId: 'agent_1_1_sourcing', action: 'Inventory scan: 3 categories at reorder point — RFQ triggers queued', entityType: 'System', autonomyLevel: 'autonomous', outcome: 'success', isAuto: true, traceId: uuidv4(), createdAt: new Date(now - 29 * 60000) },
  { _id: 'a8', agentId: 'agent_1_2_bid_eval', action: 'Award AWD-2025-0118 auto-approved: Coastal Supplies ₦67.4M — conf 0.93', entityType: 'Award', autonomyLevel: 'autonomous', outcome: 'success', isAuto: true, traceId: uuidv4(), createdAt: new Date(now - 31 * 60000) },
]

const AGENT_METRICS = [
  { _id: 'm1', agentId: 'agent_1_1_sourcing', period: '2025-Q2', totalTasks: 142, successfulTasks: 138, failedTasks: 2, hitlEscalations: 8, avgLatencyMs: 4200, avgConfidence: 0.91, status: 'busy' },
  { _id: 'm2', agentId: 'agent_1_2_bid_eval', period: '2025-Q2', totalTasks: 387, successfulTasks: 372, failedTasks: 3, hitlEscalations: 12, avgLatencyMs: 8100, avgConfidence: 0.89, status: 'active' },
  { _id: 'm3', agentId: 'agent_1_3_po_exec', period: '2025-Q2', totalTasks: 104, successfulTasks: 103, failedTasks: 1, hitlEscalations: 3, avgLatencyMs: 2800, avgConfidence: 0.97, status: 'active' },
  { _id: 'm4', agentId: 'agent_1_4_contract', period: '2025-Q2', totalTasks: 68, successfulTasks: 62, failedTasks: 4, hitlEscalations: 19, avgLatencyMs: 12400, avgConfidence: 0.76, status: 'monitoring' },
  { _id: 'm5', agentId: 'agent_1_5_vendor_mgmt', period: '2025-Q2', totalTasks: 892, successfulTasks: 889, failedTasks: 1, hitlEscalations: 2, avgLatencyMs: 5600, avgConfidence: 0.94, status: 'active' },
]

module.exports = { VENDORS, RFQS, BIDS, PURCHASE_ORDERS, CONTRACTS, HITL_QUEUE, AUDIT_LOG, AGENT_METRICS }
