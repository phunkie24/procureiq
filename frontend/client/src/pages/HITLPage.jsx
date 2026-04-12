import { useState } from 'react'
import { PageHeader, Card, CardBody } from '../components/ui'
import { useHITLQueue, useAuditLog } from '../hooks'
import { Check, X, Clock, History } from 'lucide-react'
import clsx from 'clsx'

function iconStyle(type) {
  if (!type) return 'bg-surface-2'
  const t = type.toLowerCase()
  if (t === 'warn' || t === 'warning')   return 'bg-amber-50'
  if (t === 'info')                       return 'bg-blue-50'
  if (t === 'error' || t === 'critical')  return 'bg-red-50'
  return 'bg-surface-2'
}

// ── HITL Item Card ─────────────────────────────────────────
function HITLCard({ item, onApprove, onReject, loading }) {
  const [notes, setNotes] = useState('')

  return (
    <Card>
      <div className="flex items-start gap-4 p-4">
        <div className={clsx('w-10 h-10 rounded-[10px] flex items-center justify-center text-xl flex-shrink-0', iconStyle(item.iconStyle ?? item.type ?? item.t))}>
          {item.icon ?? '📋'}
        </div>
        <div className="flex-1">
          <div className="font-semibold text-[14px] mb-0.5">{item.title}</div>
          <div className="text-[12.5px] text-ink-2 mb-1">{item.reason ?? item.description}</div>
          <div className="flex items-center gap-3 text-[11.5px] text-ink-3">
            {item.agent && <span>Agent: <strong className="text-ink">{item.agent}</strong></span>}
            {(item.value ?? item.amount) && (
              <span>Value: <strong className="text-ink">{item.value ?? `₦${(Number(item.amount) / 1e6).toFixed(1)}M`}</strong></span>
            )}
            {item.time && (
              <span className="flex items-center gap-1"><Clock size={10} /> {item.time}</span>
            )}
            {item.createdAt && (
              <span className="flex items-center gap-1"><Clock size={10} /> {new Date(item.createdAt).toLocaleTimeString()}</span>
            )}
          </div>
          <textarea
            className="mt-2 w-full border border-border rounded-md px-3 py-1.5 text-[12px] text-ink focus:outline-none focus:border-border-2 resize-none h-14"
            placeholder="Add review notes (optional)…"
            value={notes}
            onChange={e => setNotes(e.target.value)}
          />
        </div>
        <div className="flex gap-2 flex-shrink-0 pt-1">
          <button
            onClick={() => onApprove(item._id ?? item.id, notes)}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-green-500 text-white rounded-md text-[12.5px] font-medium hover:bg-green-600 transition-colors disabled:opacity-50"
          >
            <Check size={13} /> Approve
          </button>
          <button
            onClick={() => onReject(item._id ?? item.id, notes)}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-border text-ink-2 rounded-md text-[12.5px] font-medium hover:border-red-300 hover:text-red-600 transition-colors disabled:opacity-50"
          >
            <X size={13} /> Reject
          </button>
        </div>
      </div>
    </Card>
  )
}

// ── History Tab ────────────────────────────────────────────
function HistoryTab() {
  const { data: auditRaw, isLoading } = useAuditLog({ type: 'hitl', limit: 50 })
  const entries = auditRaw?.data ?? auditRaw ?? []
  const hitlEntries = entries.filter(e => !(e.isAuto ?? e.auto))

  return (
    <Card>
      <div className="p-4 border-b border-border">
        <span className="text-[13.5px] font-medium">HITL Resolution History</span>
      </div>
      {isLoading ? (
        <div className="py-10 text-center text-ink-3 text-[13px]">Loading history…</div>
      ) : hitlEntries.length > 0 ? (
        <div className="divide-y divide-border">
          {hitlEntries.map((e, i) => (
            <div key={i} className="flex items-start gap-3 px-4 py-3">
              <span className="font-mono text-[11px] text-ink-3 w-[64px] flex-shrink-0 pt-0.5">{e.time}</span>
              <div className="flex-1">
                <div className="text-[12.5px]">{e.message ?? e.msg}</div>
                {e.actor && <div className="text-[11.5px] text-ink-3 mt-0.5">by {e.actor}</div>}
              </div>
              <span className="text-[11px] font-semibold text-amber-500 flex-shrink-0">HITL</span>
            </div>
          ))}
        </div>
      ) : (
        <div className="py-10 text-center text-ink-3 text-[13px]">No HITL history yet</div>
      )}
    </Card>
  )
}

// ── Main ───────────────────────────────────────────────────
export default function HITLPage() {
  const [tab, setTab] = useState('queue')
  const [resolving, setResolving] = useState(null)

  const { data: hitlRaw, isLoading, resolve } = useHITLQueue()
  const items = hitlRaw?.data ?? hitlRaw ?? []

  const handleApprove = (id, notes) => {
    setResolving(id)
    resolve({ id, approved: true, notes }, { onSettled: () => setResolving(null) })
  }

  const handleReject = (id, notes) => {
    setResolving(id)
    resolve({ id, approved: false, notes }, { onSettled: () => setResolving(null) })
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title="HITL Queue"
        subtitle={`Human oversight gateway · ${items.length} decision${items.length !== 1 ? 's' : ''} pending`}
      >
        <button
          onClick={() => setTab(tab === 'queue' ? 'history' : 'queue')}
          className={clsx(
            'flex items-center gap-1.5 px-3 py-1.5 border border-border rounded-md text-[12.5px] transition-colors',
            tab === 'history' ? 'bg-ink text-white border-ink' : 'text-ink-2 hover:border-border-2'
          )}
        >
          <History size={13} /> {tab === 'queue' ? 'View History' : 'Queue'}
        </button>
      </PageHeader>

      {tab === 'history' ? <HistoryTab /> : (
        <>
          {isLoading && items.length === 0 && (
            <div className="text-center py-10 text-ink-3 text-[13px]">Loading queue…</div>
          )}

          <div className="space-y-3">
            {items.map(item => (
              <HITLCard
                key={item._id ?? item.id}
                item={item}
                onApprove={handleApprove}
                onReject={handleReject}
                loading={resolving === (item._id ?? item.id)}
              />
            ))}

            {!isLoading && items.length === 0 && (
              <Card>
                <CardBody>
                  <div className="text-center py-10 text-ink-3">
                    <div className="text-[32px] mb-2">✓</div>
                    <div className="text-[14px] font-medium text-ink">All decisions resolved</div>
                    <div className="text-[12.5px] mt-1">New items will appear here in real time</div>
                  </div>
                </CardBody>
              </Card>
            )}
          </div>
        </>
      )}
    </div>
  )
}
