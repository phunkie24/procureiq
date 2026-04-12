import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { PageHeader, Card, CardBody, AgentDot, Button } from '../components/ui'
import { useAgents } from '../hooks'
import { agentsApi } from '../api'
import { Settings, Play, ExternalLink, X } from 'lucide-react'
import clsx from 'clsx'

const AGENT_COLORS = {
  sourcing:    '#3b82f6',
  bid_eval:    '#8b5cf6',
  po_exec:     '#10b981',
  contract:    '#f97316',
  vendor_mgmt: '#ec4899',
}

const AGENT_PATTERNS = {
  sourcing:    'Planning · Tool Use · Parallelization · Memory',
  bid_eval:    'Parallelization · Reflection · CoT Reasoning · Guardrails',
  po_exec:     'Tool Use · Exception Handling · Idempotency',
  contract:    'Goal Setting · RAG · Exploration · Planning',
  vendor_mgmt: 'Exploration · Memory · Parallelization · Learning',
}

// ── Configure Thresholds Modal ─────────────────────────────
function ThresholdsModal({ onClose }) {
  const [values, setValues] = useState({
    autoAwardMax: 100,
    hitlThreshold: 500,
    ncMinPct: 30,
    reflectionMaxIter: 3,
  })
  const handleSave = () => {
    alert('Thresholds saved (mock — no backend persistence yet)')
    onClose()
  }
  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center">
      <div className="bg-white rounded-xl shadow-2xl w-[440px] p-6 animate-fade-up">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-[15px] font-semibold">Configure Agent Thresholds</h2>
          <button onClick={onClose} className="text-ink-3 hover:text-ink"><X size={18} /></button>
        </div>
        <div className="space-y-4">
          {[
            { key: 'autoAwardMax',      label: 'Auto-Award Maximum (₦M)',    suffix: 'M' },
            { key: 'hitlThreshold',     label: 'HITL Escalation Threshold (₦M)', suffix: 'M' },
            { key: 'ncMinPct',          label: 'Nigerian Content Minimum (%)', suffix: '%' },
            { key: 'reflectionMaxIter', label: 'Agent Reflection Max Iterations', suffix: '' },
          ].map(({ key, label, suffix }) => (
            <div key={key}>
              <label className="text-[12px] text-ink-2 mb-1 block">{label}</label>
              <div className="flex items-center border border-border rounded-md overflow-hidden">
                <input
                  type="number"
                  value={values[key]}
                  onChange={e => setValues(p => ({ ...p, [key]: e.target.value }))}
                  className="flex-1 px-3 py-2 text-[13px] focus:outline-none"
                />
                {suffix && (
                  <span className="px-3 text-[12px] text-ink-3 bg-surface-2 border-l border-border py-2">{suffix}</span>
                )}
              </div>
            </div>
          ))}
        </div>
        <div className="flex gap-2 mt-6">
          <Button variant="primary" onClick={handleSave} className="flex-1">Save Thresholds</Button>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
        </div>
      </div>
    </div>
  )
}

// ── Trigger Task Modal ─────────────────────────────────────
function TriggerModal({ agent, onClose }) {
  const [task, setTask] = useState('')
  const [loading, setLoading] = useState(false)
  const handleTrigger = async () => {
    if (!task.trim()) return
    setLoading(true)
    try {
      await agentsApi.triggerTask(agent.id, { task })
      alert(`Task sent to ${agent.name ?? agent.label}: "${task}"`)
      onClose()
    } catch {
      alert('Failed to trigger task — agent may be offline')
    } finally {
      setLoading(false)
    }
  }
  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center">
      <div className="bg-white rounded-xl shadow-2xl w-[400px] p-6 animate-fade-up">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-[15px] font-semibold">Trigger Task</h2>
          <button onClick={onClose} className="text-ink-3 hover:text-ink"><X size={18} /></button>
        </div>
        <div className="text-[12.5px] text-ink-2 mb-4">
          Agent: <strong>{agent?.name ?? agent?.label}</strong>
        </div>
        <textarea
          className="w-full border border-border rounded-md px-3 py-2 text-[13px] focus:outline-none focus:border-border-2 h-24 resize-none"
          placeholder="Describe the task for this agent…"
          value={task}
          onChange={e => setTask(e.target.value)}
        />
        <div className="flex gap-2 mt-4">
          <Button variant="primary" onClick={handleTrigger} disabled={loading} className="flex-1">
            {loading ? 'Sending…' : 'Trigger Task'}
          </Button>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
        </div>
      </div>
    </div>
  )
}

// ── Main ───────────────────────────────────────────────────
export default function Agents() {
  const navigate = useNavigate()
  const { data: agentsRaw, isLoading } = useAgents()
  const [showThresholds, setShowThresholds] = useState(false)
  const [triggerAgent, setTriggerAgent] = useState(null)

  const agents = agentsRaw?.data ?? agentsRaw ?? []

  // Fallback static data while API loads
  const FALLBACK = [
    { id: 'sourcing',    name: 'Sourcing Intelligence Agent 1',     description: 'Monitors inventory, triggers RFQs, pre-qualifies vendors',       status: 'busy',       metrics: { today: 3,   total: 142, autonomous: '94%', hitl: 8  } },
    { id: 'bid_eval',   name: 'Bid Evaluation & Award Agent 2',     description: 'Scores bids, validates compliance, auto-awards <₦100M',          status: 'active',     metrics: { today: 18,  total: 387, autonomous: '89%', hitl: 12 } },
    { id: 'po_exec',    name: 'PO Execution Agent 3',               description: '3-way matching, ERP write, vendor PO transmission',               status: 'active',     metrics: { today: 7,   total: 104, autonomous: '97%', hitl: 3  } },
    { id: 'contract',   name: 'Contract Intelligence Agent 4',      description: 'NLP risk scoring, expiry monitoring, amendment drafting',          status: 'monitoring', metrics: { today: 12,  total: 68,  autonomous: '71%', hitl: 19 } },
    { id: 'vendor_mgmt',name: 'Vendor Management Agent 5',          description: 'Scorecards, sentiment analysis, market discovery',                 status: 'active',     metrics: { today: 147, total: 892, autonomous: '98%', hitl: 2  } },
  ]

  const displayAgents = agents.length > 0 ? agents : FALLBACK

  return (
    <div className="space-y-4">
      <PageHeader title="Agent Squadron" subtitle={`All ${displayAgents.length} procurement agents · real-time status`}>
        <Button variant="outline" onClick={() => navigate('/audit')}>
          <ExternalLink size={13} /> View Logs
        </Button>
        <Button variant="primary" onClick={() => setShowThresholds(true)}>
          <Settings size={13} /> Configure Thresholds
        </Button>
      </PageHeader>

      {isLoading && agents.length === 0 && (
        <div className="text-[13px] text-ink-3 text-center py-4">Loading agents…</div>
      )}

      <div className="space-y-3">
        {displayAgents.map(a => {
          // API ids like "agent_1_1_sourcing" — match by suffix
          const shortId = Object.keys(AGENT_COLORS).find(k => (a.id ?? '').includes(k)) ?? a.id
          const color = AGENT_COLORS[shortId] ?? '#9c9a94'
          const pattern = AGENT_PATTERNS[shortId] ?? (a.patterns?.join(' · ') ?? 'Tool Use · Memory · Planning')
          // Strip "1.x" suffix from API name → e.g. "Agent 1.2" → "Agent 2"
          const displayName = (a.name ?? a.label ?? '')
            .replace(/\b1\.1\b/, '1').replace(/\b1\.2\b/, '2').replace(/\b1\.3\b/, '3')
            .replace(/\b1\.4\b/, '4').replace(/\b1\.5\b/, '5')
          // Map API field names to display values
          const totalTasks  = a.totalTasks    ?? a.metrics?.total     ?? '—'
          const hitlCount   = a.hitlEscalations ?? a.metrics?.hitl    ?? '—'
          const confidence  = a.avgConfidence != null
            ? `${Math.round(a.avgConfidence * 100)}%`
            : (a.metrics?.autonomous ?? '—')
          const latency     = a.avgLatencyMs != null
            ? `${(a.avgLatencyMs / 1000).toFixed(1)}s`
            : (a.metrics?.today ?? '—')

          return (
            <Card key={a.id}>
              <div className="flex items-start gap-4 p-4">
                <div className="w-1 self-stretch rounded-full flex-shrink-0" style={{ background: color }} />
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-0.5">
                    <AgentDot status={a.status} />
                    <span className="font-semibold text-[14px]">{displayName}</span>
                    <span className="text-[11px] text-ink-3 px-2 py-0.5 bg-surface-2 rounded-full">{a.status}</span>
                  </div>
                  <div className="text-[12.5px] text-ink-2 mb-2">{a.description ?? a.desc}</div>
                  <div className="text-[11px] text-ink-3">
                    Design patterns: <span className="text-ink">{pattern}</span>
                  </div>
                </div>
                <div className="grid grid-cols-4 gap-4 flex-shrink-0">
                  {[['Total Tasks', totalTasks], ['Confidence', confidence], ['Avg Latency', latency], ['HITL', hitlCount]].map(([l, v]) => (
                    <div key={l} className="text-center">
                      <div className="text-[18px] font-medium tracking-tight">{v}</div>
                      <div className="text-[10.5px] text-ink-3">{l}</div>
                    </div>
                  ))}
                </div>
                <button
                  onClick={() => setTriggerAgent(a)}
                  className="flex items-center gap-1.5 px-3 py-1.5 border border-border rounded-md text-[12px] text-ink-2 hover:border-border-2 hover:text-ink transition-colors flex-shrink-0"
                >
                  <Play size={11} /> Trigger
                </button>
              </div>
            </Card>
          )
        })}
      </div>

      {showThresholds && <ThresholdsModal onClose={() => setShowThresholds(false)} />}
      {triggerAgent && <TriggerModal agent={triggerAgent} onClose={() => setTriggerAgent(null)} />}
    </div>
  )
}
