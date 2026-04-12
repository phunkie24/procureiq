import { useState, useMemo } from 'react'
import { PageHeader, Card, AgentBadge, Button } from '../components/ui'
import { useAuditLog, useLiveAuditStream } from '../hooks'
import { useStore } from '../context/store'
import { Search, Download } from 'lucide-react'
import clsx from 'clsx'

const AGENT_OPTIONS = [
  { value: 'all',          label: 'All Agents' },
  { value: 'sourcing',     label: 'Sourcing 1' },
  { value: 'bid_eval',     label: 'Bid Eval 2' },
  { value: 'po_exec',      label: 'PO Exec 3' },
  { value: 'contract',     label: 'Contract 4' },
  { value: 'vendor_mgmt',  label: 'Vendor Mgmt 5' },
  { value: 'orchestrator', label: 'Orchestrator' },
]

// Derive a short display label from an agentId like "agent_1_1_sourcing"
function agentLabel(agentId = '') {
  const id = agentId.toLowerCase()
  if (!id || id === 'system') return 'System'
  if (id === 'orchestrator')      return 'Orchestrator'
  if (id.includes('vendor_mgmt')) return 'Vendor Mgmt 5'
  if (id.includes('contract'))    return 'Contract 4'
  if (id.includes('po_exec'))     return 'PO Exec 3'
  if (id.includes('bid_eval'))    return 'Bid Eval 2'
  if (id.includes('sourcing'))    return 'Sourcing 1'
  return agentId
}

// Map filter value → agentId substring for matching
const FILTER_TO_ID = {
  sourcing:    'sourcing',
  bid_eval:    'bid_eval',
  po_exec:     'po_exec',
  contract:    'contract',
  vendor_mgmt: 'vendor_mgmt',
  orchestrator:'orchestrator',
}

// Normalize any entry shape (API or live stream) into a consistent object
function normalise(e) {
  const id  = e.agentId  ?? e.agent  ?? 'orchestrator'
  const lbl = agentLabel(id)  // always re-derive so stale backend labels are overridden
  const msg = e.action   ?? e.message ?? e.msg ?? ''
  const auto = e.isAuto  ?? e.auto   ?? true
  const time = e.time    ?? (e.createdAt
    ? new Date(e.createdAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    : (e.timestamp
      ? new Date(e.timestamp).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
      : '—'))
  return { ...e, agentId: id, agentLabel: lbl, message: msg, isAuto: auto, time }
}

const PAGE_SIZE = 20

export default function AuditLog() {
  const [search, setSearch] = useState('')
  const [agentFilter, setAgentFilter] = useState('all')
  const [typeFilter, setTypeFilter] = useState('all')
  const [page, setPage] = useState(1)

  useLiveAuditStream()
  const liveEntries = useStore(s => s.auditLog)

  const { data: apiRaw, isLoading } = useAuditLog({ limit: 200 })
  const apiEntries = apiRaw?.data ?? apiRaw ?? []

  // Normalise + deduplicate by (time :: message)
  const merged = useMemo(() => {
    const seen = new Set()
    return [...liveEntries, ...apiEntries]
      .map(normalise)
      .filter(e => {
        const key = `${e.time}::${e.message}`
        if (seen.has(key)) return false
        seen.add(key)
        return true
      })
  }, [liveEntries, apiEntries])

  // Client-side filtering
  const filtered = useMemo(() => {
    return merged.filter(e => {
      const text  = e.message.toLowerCase()
      const agent = e.agentId.toLowerCase()

      if (search && !text.includes(search.toLowerCase()) && !agent.includes(search.toLowerCase())) return false

      // agentFilter value is a substring of agentId (e.g. "sourcing" ⊂ "agent_1_1_sourcing")
      if (agentFilter !== 'all' && !agent.includes(FILTER_TO_ID[agentFilter] ?? agentFilter)) return false

      if (typeFilter === 'AUTO' && !e.isAuto)  return false
      if (typeFilter === 'HITL' &&  e.isAuto)  return false
      return true
    })
  }, [merged, search, agentFilter, typeFilter])

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const pageEntries = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  const setFilter = (fn) => { fn(); setPage(1) }

  const exportCSV = () => {
    const header = 'Time,Agent,Message,Type'
    const rows = filtered.map(e =>
      `${e.time},${e.agentLabel},${e.message.replace(/,/g, ';')},${e.isAuto ? 'AUTO' : 'HITL'}`
    )
    const blob = new Blob([[header, ...rows].join('\n')], { type: 'text/csv' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    a.href     = url
    a.download = `audit-log-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="space-y-4">
      <PageHeader title="Audit Trail" subtitle="Complete immutable record of all agent actions">
        <Button variant="outline" onClick={exportCSV}>
          <Download size={13} /> Export CSV
        </Button>
      </PageHeader>

      <Card>
        <div className="p-4 border-b border-border flex items-center gap-3 flex-wrap">
          <div className="relative flex-1 min-w-[200px]">
            <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-3" />
            <input
              placeholder="Search actions…"
              className="w-full border border-border rounded-md pl-7 pr-3 py-1.5 text-[13px] focus:outline-none focus:border-border-2"
              value={search}
              onChange={e => setFilter(() => setSearch(e.target.value))}
            />
          </div>
          <select
            value={agentFilter}
            onChange={e => setFilter(() => setAgentFilter(e.target.value))}
            className="border border-border rounded-md px-2.5 py-1.5 text-[12.5px] font-sans text-ink-2 bg-white focus:outline-none"
          >
            {AGENT_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
          <select
            value={typeFilter}
            onChange={e => setFilter(() => setTypeFilter(e.target.value))}
            className="border border-border rounded-md px-2.5 py-1.5 text-[12.5px] font-sans text-ink-2 bg-white focus:outline-none"
          >
            <option value="all">All Types</option>
            <option value="AUTO">AUTO</option>
            <option value="HITL">HITL</option>
          </select>
          <div className="flex items-center gap-1.5 ml-auto">
            <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
            <span className="text-[11.5px] text-ink-3">Live · {filtered.length} entries</span>
          </div>
        </div>

        {isLoading && merged.length === 0 ? (
          <div className="py-10 text-center text-ink-3 text-[13px]">Loading audit log…</div>
        ) : (
          <>
            <div className="divide-y divide-border">
              {pageEntries.length === 0 && (
                <div className="px-4 py-10 text-center text-ink-3 text-[13px]">
                  No entries match the current filters
                </div>
              )}
              {pageEntries.map((e, i) => (
                <div key={i} className="flex items-start gap-3 px-4 py-2.5 hover:bg-surface-2 transition-colors">
                  <span className="font-mono text-[11px] text-ink-3 flex-shrink-0 pt-0.5 w-[64px]">
                    {e.time}
                  </span>
                  <AgentBadge agent={e.agentId} label={e.agentLabel} />
                  <span className="flex-1 text-[12.5px] text-ink-2">{e.message}</span>
                  <span className={clsx(
                    'text-[10.5px] font-semibold flex-shrink-0',
                    e.isAuto ? 'text-green-600' : 'text-amber-500'
                  )}>
                    {e.isAuto ? 'AUTO' : 'HITL'}
                  </span>
                </div>
              ))}
            </div>

            {totalPages > 1 && (
              <div className="flex items-center justify-between px-4 py-3 border-t border-border">
                <span className="text-[12px] text-ink-3">
                  Page {page} of {totalPages} · {filtered.length} total
                </span>
                <div className="flex gap-1.5">
                  <button
                    onClick={() => setPage(p => Math.max(1, p - 1))}
                    disabled={page === 1}
                    className="px-3 py-1 border border-border rounded text-[12px] disabled:opacity-40 hover:border-border-2 transition-colors"
                  >
                    Prev
                  </button>
                  <button
                    onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                    disabled={page === totalPages}
                    className="px-3 py-1 border border-border rounded text-[12px] disabled:opacity-40 hover:border-border-2 transition-colors"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </Card>
    </div>
  )
}
