import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  AreaChart, Area, BarChart, Bar, LineChart, Line,
  XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid
} from 'recharts'
import {
  StatCard, Card, CardHeader, CardBody,
  KPIRow, AgentDot, AgentBadge,
  PageHeader, Button
} from '../components/ui'
import { useStore } from '../context/store'
import { Check, X, RefreshCw, Plus } from 'lucide-react'
import clsx from 'clsx'
import {
  useDashboardStats, useSpendData,
  useAgents, useHITLQueue, useLiveAuditStream
} from '../hooks'

// ── Derive clean agent label from raw agentId ─────────────────
function resolveLabel(agentId = '') {
  const id = agentId.toLowerCase()
  if (id === 'orchestrator')      return 'Orchestrator'
  if (id.includes('vendor_mgmt')) return 'Vendor Mgmt 5'
  if (id.includes('contract'))    return 'Contract 4'
  if (id.includes('po_exec'))     return 'PO Exec 3'
  if (id.includes('bid_eval'))    return 'Bid Eval 2'
  if (id.includes('sourcing'))    return 'Sourcing 1'
  return agentId
}

// ── Agent accent colours (by id) ──────────────────────────────
const AGENT_ACCENTS = {
  sourcing:   '#3b82f6',
  bid_eval:   '#8b5cf6',
  po_exec:    '#10b981',
  contract:   '#f97316',
  vendor_mgmt:'#ec4899',
}

// ── Fallback chart data ───────────────────────────────────────
const SPEND_FALLBACK = [
  { name: 'Jan', capex: 3.2, opex: 1.1 },
  { name: 'Feb', capex: 4.1, opex: 1.3 },
  { name: 'Mar', capex: 5.8, opex: 1.6 },
  { name: 'Apr', capex: 6.2, opex: 1.8 },
  { name: 'May', capex: 7.1, opex: 1.4 },
  { name: 'Jun', capex: 6.8, opex: 1.9 },
  { name: 'Jul', capex: 7.9, opex: 2.1 },
]

const VENDOR_SCORES = [
  { name: 'Jan', score: 76 }, { name: 'Feb', score: 78 },
  { name: 'Mar', score: 79 }, { name: 'Apr', score: 80 },
  { name: 'May', score: 81 }, { name: 'Jun', score: 82 }, { name: 'Jul', score: 82.4 },
]

// ── Custom Tooltip ─────────────────────────────────────────
const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-ink text-white px-3 py-2 rounded-lg text-xs shadow-lg">
      <div className="font-medium mb-1">{label}</div>
      {payload.map((p, i) => (
        <div key={i} className="flex items-center gap-2">
          <div className="w-1.5 h-1.5 rounded-full" style={{ background: p.color }} />
          <span className="opacity-75">{p.name}:</span>
          <span className="font-medium">{p.value}</span>
        </div>
      ))}
    </div>
  )
}

// ── AI Box ─────────────────────────────────────────────────
function AIBox() {
  const [query, setQuery] = useState('I want to know what caused the drop-off from bids to ')
  const handleSubmit = () => {
    alert(`Agent Analysis for: "${query}/awards"\n\nBid → Award drop-off analysis:\n• Failed completeness check\n• Failed NC/compliance verification\n• Abnormally low pricing flagged\n• Pending HITL approval`)
  }
  return (
    <div className="bg-gradient-to-r from-blue-50 to-green-50 border border-blue-200 rounded-lg mx-4 mb-3 px-3 py-2">
      <div className="flex items-center gap-1.5 text-[12px] text-blue-600 font-medium mb-1.5">
        <span>✦</span> What would you like to explore next?
      </div>
      <div className="flex items-center gap-2">
        <input
          className="flex-1 bg-transparent border-none outline-none text-[13px] text-ink font-sans"
          value={query}
          onChange={e => setQuery(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleSubmit()}
        />
        <button
          onClick={handleSubmit}
          className="bg-blue-100 text-blue-700 px-2.5 py-1 rounded text-[12px] font-medium cursor-pointer hover:bg-blue-200 transition-colors whitespace-nowrap"
        >
          /awards
        </button>
      </div>
    </div>
  )
}

// ── Main Overview ──────────────────────────────────────────
export default function Overview() {
  const navigate = useNavigate()
  const [activeStatIdx, setActiveStatIdx] = useState(2)
  const [agentFilter, setAgentFilter] = useState('all')

  const { data: stats, refetch: refetchStats } = useDashboardStats()
  const { data: spendRaw } = useSpendData()
  const { data: agentsRaw } = useAgents()
  const { data: hitlRaw, resolve: resolveHITL } = useHITLQueue()

  useLiveAuditStream()
  const auditLog = useStore(s => s.auditLog)

  const agents = agentsRaw?.data ?? agentsRaw ?? []
  const hitlItems = hitlRaw?.data ?? hitlRaw ?? []
  const spendData = spendRaw?.data ?? spendRaw ?? SPEND_FALLBACK

  const STATS = [
    { label: 'Initiated RFQs', value: stats?.rfqsInitiated ?? '—', change: '+12%', dir: 'up' },
    { label: 'Bids Received',  value: stats?.bidsReceived  ?? '—', change: '+8%',  dir: 'up' },
    { label: 'Awards Made',    value: stats?.awardsMade    ?? '—', change: '+5%',  dir: 'up' },
    { label: 'POs Issued',     value: stats?.posIssued     ?? '—', change: '-3%',  dir: 'down' },
    { label: 'HITL Pending',   value: stats?.hitlPending   ?? '—', change: '+2',   dir: 'up' },
  ]

  const funnelData = [
    { name: 'Init',   v: stats?.rfqsInitiated ?? 0, label: 'Initiated' },
    { name: 'Bids',   v: stats?.bidsReceived  ?? 0, label: 'Bids In' },
    { name: 'Awards', v: stats?.awardsMade    ?? 0, label: 'Awards' },
    { name: 'POs',    v: stats?.posIssued     ?? 0, label: 'POs Issued' },
  ]

  const totalSpend = stats?.totalSpendNGN
    ? `₦${(stats.totalSpendNGN / 1e9).toFixed(1)}B`
    : '₦41.5B'

  const ncAvg = stats?.nigerianContentAvg ?? 75

  // Filter agent activity (audit log) by selected agent
  const filteredAudit = agentFilter === 'all'
    ? auditLog.slice(0, 8)
    : auditLog.filter(e => e.agentId === agentFilter || e.agent === agentFilter).slice(0, 8)

  return (
    <div className="space-y-4">
      <PageHeader
        title="Overview"
        subtitle={`Yahoo Finance · Procurement Agent Squadron · ${stats?.agentsActive ?? 5} agents operational`}
      >
        <Button variant="outline" onClick={() => refetchStats()}>
          <RefreshCw size={13} /> Refresh
        </Button>
        <Button variant="primary" onClick={() => navigate('/sourcing')}>
          <Plus size={13} /> New RFQ
        </Button>
      </PageHeader>

      {/* STAT CARDS */}
      <div className="grid grid-cols-5 gap-3">
        {STATS.map((s, i) => (
          <StatCard
            key={s.label}
            {...s}
            changeDir={s.dir}
            active={activeStatIdx === i}
            onClick={() => setActiveStatIdx(i)}
          />
        ))}
      </div>

      {/* AGENT CARDS */}
      <div className="grid grid-cols-5 gap-2">
        {agents.length > 0 ? agents.map((a) => {
          // API ids are like "agent_1_1_sourcing" — match by suffix key
          const shortId = Object.keys(AGENT_ACCENTS).find(k => (a.id ?? '').includes(k)) ?? a.id
          const accent = AGENT_ACCENTS[shortId] ?? '#9c9a94'
          // Map API fields to card display
          const metric      = a.totalTasks != null ? a.totalTasks : '—'
          const metricLabel = 'Total tasks'
          const todayVal    = a.avgConfidence != null
            ? `${Math.round(a.avgConfidence * 100)}% conf`
            : '—'
          const displayName = (a.name ?? a.label ?? '')
            .replace(/\b1\.1\b/, '1').replace(/\b1\.2\b/, '2').replace(/\b1\.3\b/, '3')
            .replace(/\b1\.4\b/, '4').replace(/\b1\.5\b/, '5')
          return (
            <div key={a.id} className="agent-card" style={{ '--accent': accent }}>
              <div className="absolute top-0 left-0 right-0 h-[3px]" style={{ background: accent }} />
              <div className="flex items-center gap-1.5 mb-1.5">
                <AgentDot status={a.status} />
                <span className="text-[11px] text-ink-3">
                  {a.status === 'busy' || a.status === 'monitoring' ? 'Processing' : 'Active'}
                </span>
              </div>
              <div className="text-[12.5px] font-semibold mb-0.5">{displayName}</div>
              <div className="text-[11px] text-ink-3 mb-2">{a.description ?? a.sub}</div>
              <div className="text-[20px] font-medium tracking-tight">{metric}</div>
              <div className="text-[10.5px] text-ink-3">{metricLabel}</div>
              <div className="flex items-center gap-1 mt-2 pt-2 border-t border-border text-[10.5px] text-ink-3">
                Confidence: <span className="text-ink font-medium">{todayVal}</span>
              </div>
            </div>
          )
        }) : (
          // skeleton placeholders while loading
          Array.from({ length: 5 }, (_, i) => (
            <div key={i} className="agent-card animate-pulse">
              <div className="h-3 bg-surface-3 rounded mb-2 w-2/3" />
              <div className="h-5 bg-surface-3 rounded mb-1 w-1/2" />
              <div className="h-3 bg-surface-3 rounded w-3/4" />
            </div>
          ))
        )}
      </div>

      {/* PIPELINE + KPI SIDE */}
      <div className="grid grid-cols-[1fr_280px] gap-3">
        <Card>
          <CardHeader title="Procurement Pipeline" action="···" />
          <div className="flex justify-between px-4 pt-3 pb-1">
            {funnelData.map((f, i) => (
              <div key={i} className="text-center flex-1">
                <div className={clsx('text-[15px] font-medium tracking-tight', i === 2 && 'text-blue-500')}>{f.v}</div>
                <div className={clsx('text-[11px] mt-0.5', i === 2 ? 'text-blue-500 font-medium' : 'text-ink-3')}>{f.label}</div>
              </div>
            ))}
          </div>
          <div className="px-4 pb-0">
            <ResponsiveContainer width="100%" height={110}>
              <BarChart data={funnelData} barSize={60}>
                <CartesianGrid vertical={false} stroke="#f0eeea" />
                <YAxis tick={{ fontSize: 10, fill: '#9c9a94', fontFamily: 'DM Mono' }} axisLine={false} tickLine={false} />
                <XAxis dataKey="name" hide />
                <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(0,0,0,.03)' }} />
                <Bar dataKey="v" name="Count" radius={[4, 4, 0, 0]} fill="rgba(59,130,246,0.8)" />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <AIBox />
        </Card>

        {/* KPI side panel */}
        <div className="flex flex-col gap-3">
          <Card className="p-4">
            <div className="text-[11.5px] text-ink-3 mb-1">Total Spend Volume</div>
            <div className="text-[30px] font-light tracking-[-1.5px] mb-3">{totalSpend}</div>
            <KPIRow label="Capex"    value="₦29.8B" pct={72} color="#3b82f6" />
            <KPIRow label="Opex"     value="₦8.6B"  pct={45} color="#10b981" />
            <KPIRow label="Services" value="₦3.1B"  pct={17} color="#ec4899" />
            <div className="mt-3">
              <ResponsiveContainer width="100%" height={44}>
                <AreaChart data={spendData}>
                  <Area type="monotone" dataKey="capex" stroke="#3b82f6" fill="rgba(59,130,246,.08)" strokeWidth={1.5} dot={false} />
                  <Area type="monotone" dataKey="opex"  stroke="#10b981" fill="rgba(16,185,129,.08)" strokeWidth={1.5} dot={false} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </Card>
          <div className="bg-gradient-to-br from-amber-400 to-orange-500 rounded-[10px] p-4 text-white relative overflow-hidden">
            <div className="absolute bottom-[-10px] right-[-8px] text-[60px] font-semibold opacity-20 leading-none">{ncAvg}%</div>
            <div className="inline-flex items-center gap-1 bg-white/25 rounded-full px-2 py-0.5 text-[11px] font-medium mb-2">💡 Insights</div>
            <div className="text-[13.5px] font-semibold mb-1">Nigerian Content</div>
            <div className="text-[12px] opacity-85">Avg {ncAvg}% NC across all contracts — {ncAvg - 70}pts above regulatory target</div>
          </div>
        </div>
      </div>

      {/* BOTTOM 3 */}
      <div className="grid grid-cols-3 gap-3">
        {/* HITL Queue */}
        <Card>
          <div className="flex items-center justify-between px-4 pt-4 pb-2">
            <div className="flex items-center gap-2">
              <span className="text-[13.5px] font-medium">HITL Queue</span>
              <span className="bg-red-100 text-red-700 text-[11px] font-semibold px-1.5 py-0.5 rounded-full">
                {hitlItems.length}
              </span>
            </div>
            <span
              className="text-[12px] text-blue-500 cursor-pointer hover:text-blue-700"
              onClick={() => navigate('/hitl')}
            >
              View all
            </span>
          </div>
          <CardBody className="pt-1">
            {hitlItems.slice(0, 4).map((item) => (
              <div key={item._id} className="flex items-center gap-2 py-2 border-b border-border last:border-0">
                <div className={clsx(
                  'w-7 h-7 rounded-[7px] flex items-center justify-center text-[13px] flex-shrink-0',
                  item.iconStyle === 'warn'  && 'bg-amber-50',
                  item.iconStyle === 'info'  && 'bg-blue-50',
                  item.iconStyle === 'error' && 'bg-red-50',
                  !item.iconStyle && 'bg-surface-2',
                )}>
                  {item.icon ?? '📋'}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-[12px] font-medium truncate">{item.title}</div>
                  <div className="text-[11px] text-ink-3 truncate">
                    {item.meta ?? `${item.agent ?? ''} · ${item.value ?? ''}`}
                  </div>
                </div>
                <div className="flex gap-1.5 flex-shrink-0">
                  <button
                    onClick={() => resolveHITL({ id: item._id, approved: true })}
                    className="p-1 bg-green-500 text-white rounded hover:bg-green-600 transition-colors"
                  >
                    <Check size={11} />
                  </button>
                  <button
                    onClick={() => resolveHITL({ id: item._id, approved: false })}
                    className="p-1 bg-surface-2 text-ink-2 border border-border rounded hover:border-red-300 hover:text-red-500 transition-colors"
                  >
                    <X size={11} />
                  </button>
                </div>
              </div>
            ))}
            {hitlItems.length === 0 && (
              <div className="text-center py-6 text-ink-3 text-[13px]">✓ Queue cleared</div>
            )}
          </CardBody>
        </Card>

        {/* Vendor Performance */}
        <Card>
          <CardHeader title="Vendor Performance" action="···" />
          <CardBody>
            <div className="flex items-baseline gap-2 mb-1">
              <span className="text-[26px] font-light tracking-tight">82.4</span>
              <span className="text-[13px] text-ink-3">avg score</span>
              <span className="text-[12px] text-green-600 font-medium ml-1">+3.2 pts</span>
            </div>
            <ResponsiveContainer width="100%" height={65}>
              <LineChart data={VENDOR_SCORES}>
                <Line type="monotone" dataKey="score" stroke="#ec4899" strokeWidth={2} dot={{ fill: '#ec4899', r: 2 }} />
                <Tooltip content={<CustomTooltip />} />
              </LineChart>
            </ResponsiveContainer>
            <div className="mt-2 space-y-1.5">
              {[['On Probation', '8 vendors', '#f59e0b'], ['Strategic Partners', '23 vendors', '#10b981'], ['New Discoveries', '12 candidates', '#3b82f6']].map(([label, val, color]) => (
                <div key={label} className="flex justify-between items-center text-[12px]">
                  <span className="text-ink-2">{label}</span>
                  <span className="font-medium" style={{ color }}>{val}</span>
                </div>
              ))}
            </div>
          </CardBody>
        </Card>

        {/* Agent Events */}
        <Card>
          <CardHeader title="Agent Events Today" action="···" />
          <CardBody>
            <div className="text-[11px] text-ink-3 mb-1">Live stream</div>
            <div className="text-[26px] font-light tracking-tight">{auditLog.length > 0 ? auditLog.length : '—'}</div>
            <div className="text-[11.5px] text-ink-3 mb-2">entries captured this session</div>
            <div className="space-y-1 mt-2">
              {auditLog.slice(0, 4).map((e, i) => (
                <div key={i} className="text-[11px] text-ink-3 truncate">
                  <span className="font-mono">{e.time}</span> · {e.message ?? e.msg}
                </div>
              ))}
              {auditLog.length === 0 && (
                <div className="text-[11.5px] text-ink-3">Waiting for live events…</div>
              )}
            </div>
          </CardBody>
        </Card>
      </div>

      {/* LIVE AUDIT LOG */}
      <Card>
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <span className="text-[13.5px] font-medium">Live Audit Log</span>
          <div className="flex items-center gap-3">
            <select
              value={agentFilter}
              onChange={e => setAgentFilter(e.target.value)}
              className="border border-border rounded-md px-2.5 py-1.5 text-[12px] text-ink-2 bg-white font-sans cursor-pointer focus:outline-none"
            >
              <option value="all">All Agents</option>
              <option value="sourcing">Sourcing 1</option>
              <option value="bid_eval">Bid Eval 2</option>
              <option value="po_exec">PO Exec 3</option>
              <option value="contract">Contract 4</option>
              <option value="vendor_mgmt">Vendor Mgmt 5</option>
            </select>
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
              <span className="text-[11.5px] text-ink-3">Live</span>
            </div>
          </div>
        </div>
        <CardBody className="py-1">
          {filteredAudit.length > 0 ? filteredAudit.map((entry, i) => (
            <div key={i} className="flex items-start gap-2.5 py-1.5 border-b border-border last:border-0">
              <span className="font-mono text-[11px] text-ink-3 flex-shrink-0 pt-0.5 w-[60px]">
                {entry.time ?? (entry.timestamp
                  ? new Date(entry.timestamp).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
                  : '—')}
              </span>
              <AgentBadge agent={entry.agentId ?? entry.agent} label={resolveLabel(entry.agentId ?? entry.agent)} />
              <span className="text-[12.5px] text-ink-2 flex-1">{entry.message ?? entry.msg}</span>
              <span className={clsx('text-[10.5px] font-semibold flex-shrink-0',
                (entry.isAuto ?? entry.auto) ? 'text-green-600' : 'text-amber-500'
              )}>
                {(entry.isAuto ?? entry.auto) ? 'AUTO' : 'HITL'}
              </span>
            </div>
          )) : (
            <div className="py-6 text-center text-ink-3 text-[13px]">
              Waiting for agent events — they'll appear here in real time
            </div>
          )}
        </CardBody>
      </Card>
    </div>
  )
}
