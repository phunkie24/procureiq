const mongoose = require('mongoose')
const { Schema } = mongoose

// ── Vendor ────────────────────────────────────────────────
const VendorSchema = new Schema({
  name: { type: String, required: true, trim: true },
  vendorCode: { type: String, required: true, unique: true },
  email: { type: String, required: true },
  phone: String,
  categories: [String],
  nigerianContentPct: { type: Number, min: 0, max: 100, default: 0 },
  financialStabilityScore: { type: Number, min: 0, max: 10, default: 5 },
  performanceScore: { type: Number, min: 0, max: 100, default: 50 },
  status: { type: String, enum: ['active', 'probation', 'suspended', 'blacklisted'], default: 'active' },
  certifications: [String],
  onboardedAt: Date,
}, { timestamps: true })

// ── RFQ ──────────────────────────────────────────────────
const RFQItemSchema = new Schema({
  lineNo: Number,
  description: { type: String, required: true },
  quantity: { type: Number, required: true },
  unitOfMeasure: { type: String, default: 'EA' },
  estimatedUnitPrice: Number,
  technicalSpecs: String,
})

const RFQSchema = new Schema({
  rfqNumber: { type: String, required: true, unique: true },
  title: { type: String, required: true },
  category: { type: String, required: true },
  items: [RFQItemSchema],
  invitedVendors: [{ type: Schema.Types.ObjectId, ref: 'Vendor' }],
  submissionDeadline: { type: Date, required: true },
  estimatedValue: { type: Number, required: true },
  autonomyLevel: { type: String, enum: ['autonomous', 'recommend', 'human_required'] },
  status: { type: String, enum: ['draft', 'issued', 'open', 'evaluating', 'awarded', 'cancelled'], default: 'draft' },
  issuedBy: { type: String, default: 'agent_1_1_sourcing' },
  issuedAt: Date,
  traceId: String,
}, { timestamps: true })

// ── Bid ──────────────────────────────────────────────────
const BidItemSchema = new Schema({
  lineNo: Number,
  unitPrice: Number,
  totalPrice: Number,
  deliveryDays: Number,
  notes: String,
})

const BidSchema = new Schema({
  rfqId: { type: Schema.Types.ObjectId, ref: 'RFQ', required: true },
  vendorId: { type: Schema.Types.ObjectId, ref: 'Vendor', required: true },
  bidNumber: { type: String, required: true, unique: true },
  items: [BidItemSchema],
  totalValue: { type: Number, required: true },
  deliveryLeadTimeDays: Number,
  validityDays: { type: Number, default: 60 },
  complianceDeclarations: { type: Map, of: Boolean },
  isComplete: { type: Boolean, default: false },

  // Scoring (populated by Agent 1.2)
  priceScore: Number,
  qualityScore: Number,
  deliveryScore: Number,
  complianceScore: Number,
  nigerianContentScore: Number,
  weightedTotal: Number,
  rank: Number,
  justification: String,
  flags: [String],
  scoredAt: Date,
}, { timestamps: true })

// ── Purchase Order ─────────────────────────────────────────
const POLineSchema = new Schema({
  lineNo: Number,
  description: String,
  quantity: Number,
  unitPrice: Number,
  totalPrice: Number,
  glCode: String,
  costCenter: String,
  deliveryDate: Date,
})

const PurchaseOrderSchema = new Schema({
  poNumber: { type: String, required: true, unique: true },
  vendorId: { type: Schema.Types.ObjectId, ref: 'Vendor', required: true },
  rfqId: { type: Schema.Types.ObjectId, ref: 'RFQ' },
  lines: [POLineSchema],
  totalValue: { type: Number, required: true },
  currency: { type: String, default: 'NGN' },
  paymentTerms: { type: String, default: 'NET30' },
  deliveryAddress: String,
  status: { type: String, enum: ['pending', 'issued', 'acknowledged', 'partially_delivered', 'completed', 'cancelled'], default: 'pending' },
  erpPoId: String,
  issuedAt: Date,
  vendorAcknowledgedAt: Date,
  traceId: String,
}, { timestamps: true })

// ── Contract ─────────────────────────────────────────────
const ContractSchema = new Schema({
  contractNumber: { type: String, required: true, unique: true },
  vendorId: { type: Schema.Types.ObjectId, ref: 'Vendor', required: true },
  title: { type: String, required: true },
  scope: String,
  startDate: { type: Date, required: true },
  endDate: { type: Date, required: true },
  totalValue: { type: Number, required: true },
  currency: { type: String, default: 'NGN' },
  slaTerms: { type: Map, of: Schema.Types.Mixed },
  penaltyClauses: { type: Map, of: Schema.Types.Mixed },
  status: { type: String, enum: ['draft', 'active', 'expiring', 'expired', 'renewed', 'terminated'], default: 'draft' },
  autoRenewal: { type: Boolean, default: false },
  nlpRiskScore: { type: Number, min: 0, max: 10, default: 0 },
  unfavorableClauses: [String],
  lastMonitoredAt: Date,
}, { timestamps: true })

// ── HITL Request ─────────────────────────────────────────
const HITLSchema = new Schema({
  requestingAgent: { type: String, required: true },
  decisionType: { type: String, required: true },
  contextSummary: String,
  recommendedAction: String,
  entityType: String,
  entityId: String,
  estimatedValue: Number,
  deadline: Date,
  status: { type: String, enum: ['pending', 'approved', 'rejected', 'expired'], default: 'pending' },
  resolvedBy: String,
  resolution: String,
  resolvedAt: Date,
  traceId: String,
  priority: { type: String, enum: ['critical', 'high', 'medium', 'low'], default: 'medium' },
}, { timestamps: true })

// ── Audit Record ─────────────────────────────────────────
const AuditSchema = new Schema({
  agentId: { type: String, required: true },
  action: { type: String, required: true },
  entityType: String,
  entityId: String,
  autonomyLevel: { type: String, enum: ['autonomous', 'recommend', 'human_required'] },
  humanActor: String,
  outcome: { type: String, enum: ['success', 'failure', 'escalated'] },
  details: { type: Map, of: Schema.Types.Mixed },
  traceId: String,
  isAuto: { type: Boolean, default: true },
}, { timestamps: true })

// ── Agent Metric ─────────────────────────────────────────
const AgentMetricSchema = new Schema({
  agentId: { type: String, required: true },
  period: String,
  totalTasks: { type: Number, default: 0 },
  successfulTasks: { type: Number, default: 0 },
  failedTasks: { type: Number, default: 0 },
  hitlEscalations: { type: Number, default: 0 },
  avgLatencyMs: { type: Number, default: 0 },
  avgConfidence: { type: Number, default: 0 },
  totalCostEstimateUsd: { type: Number, default: 0 },
  status: { type: String, enum: ['active', 'busy', 'idle', 'monitoring', 'error'], default: 'active' },
}, { timestamps: true })

module.exports = {
  Vendor: mongoose.model('Vendor', VendorSchema),
  RFQ: mongoose.model('RFQ', RFQSchema),
  Bid: mongoose.model('Bid', BidSchema),
  PurchaseOrder: mongoose.model('PurchaseOrder', PurchaseOrderSchema),
  Contract: mongoose.model('Contract', ContractSchema),
  HITL: mongoose.model('HITL', HITLSchema),
  Audit: mongoose.model('Audit', AuditSchema),
  AgentMetric: mongoose.model('AgentMetric', AgentMetricSchema),
}
