import { useState } from 'react'
import { PageHeader, Card, StatusBadge, Button } from '../components/ui'
import { useRFQs, useCreateRFQ } from '../hooks'
import { bidsApi } from '../api'
import { Plus, X, ChevronDown, Eye } from 'lucide-react'
import clsx from 'clsx'

const CATEGORIES = ['Mechanical', 'Electrical', 'IT Equipment', 'Services', 'Civil', 'Chemicals', 'Drilling', 'Subsea']

// ── Status map ────────────────────────────────────────────
function statusInfo(status) {
  const map = {
    open:       { badge: 'pending',  label: 'Open' },
    issued:     { badge: 'review',   label: 'Issued' },
    evaluating: { badge: 'active',   label: 'Evaluating' },
    awarded:    { badge: 'success',  label: 'Awarded' },
    cancelled:  { badge: 'failed',   label: 'Cancelled' },
  }
  return map[status?.toLowerCase()] ?? { badge: 'pending', label: status ?? 'Open' }
}

// ── New RFQ Modal ─────────────────────────────────────────
function NewRFQModal({ onClose }) {
  const createRFQ = useCreateRFQ()
  const [form, setForm] = useState({
    title: '', category: CATEGORIES[0], estimatedValue: '', deadline: '', notes: '',
  })
  const [error, setError] = useState('')

  const set = (k, v) => setForm(p => ({ ...p, [k]: v }))

  const handleSubmit = async () => {
    if (!form.title || !form.estimatedValue || !form.deadline) {
      setError('Title, estimated value, and deadline are required.')
      return
    }
    try {
      await createRFQ.mutateAsync(form)
      onClose()
    } catch (e) {
      setError(e?.message ?? 'Failed to create RFQ')
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center">
      <div className="bg-white rounded-xl shadow-2xl w-[500px] p-6 animate-fade-up">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-[15px] font-semibold">New RFQ</h2>
          <button onClick={onClose} className="text-ink-3 hover:text-ink"><X size={18} /></button>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 text-[12.5px] px-3 py-2 rounded-md mb-4">
            {error}
          </div>
        )}

        <div className="space-y-4">
          <div>
            <label className="text-[12px] text-ink-2 mb-1 block">RFQ Title *</label>
            <input
              className="w-full border border-border rounded-md px-3 py-2 text-[13px] focus:outline-none focus:border-border-2"
              placeholder="e.g. Supply of Subsea Control Modules"
              value={form.title}
              onChange={e => set('title', e.target.value)}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[12px] text-ink-2 mb-1 block">Category</label>
              <select
                className="w-full border border-border rounded-md px-3 py-2 text-[13px] bg-white focus:outline-none focus:border-border-2"
                value={form.category}
                onChange={e => set('category', e.target.value)}
              >
                {CATEGORIES.map(c => <option key={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="text-[12px] text-ink-2 mb-1 block">Estimated Value (₦)</label>
              <input
                type="number"
                className="w-full border border-border rounded-md px-3 py-2 text-[13px] focus:outline-none focus:border-border-2"
                placeholder="e.g. 28500000"
                value={form.estimatedValue}
                onChange={e => set('estimatedValue', e.target.value)}
              />
            </div>
          </div>

          <div>
            <label className="text-[12px] text-ink-2 mb-1 block">Bid Deadline *</label>
            <input
              type="date"
              className="w-full border border-border rounded-md px-3 py-2 text-[13px] focus:outline-none focus:border-border-2"
              value={form.deadline}
              onChange={e => set('deadline', e.target.value)}
            />
          </div>

          <div>
            <label className="text-[12px] text-ink-2 mb-1 block">Notes / Scope</label>
            <textarea
              className="w-full border border-border rounded-md px-3 py-2 text-[13px] focus:outline-none focus:border-border-2 h-20 resize-none"
              placeholder="Brief scope description…"
              value={form.notes}
              onChange={e => set('notes', e.target.value)}
            />
          </div>
        </div>

        <div className="flex gap-2 mt-6">
          <Button
            variant="primary"
            onClick={handleSubmit}
            disabled={createRFQ.isPending}
            className="flex-1"
          >
            {createRFQ.isPending ? 'Creating…' : 'Create RFQ'}
          </Button>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
        </div>
      </div>
    </div>
  )
}

// ── Bids Panel ────────────────────────────────────────────
function BidsPanel({ rfq, onClose }) {
  const [bids, setBids] = useState(null)
  const [loading, setLoading] = useState(true)

  useState(() => {
    bidsApi.getByRFQ(rfq._id ?? rfq.ref)
      .then(data => setBids(data?.data ?? data ?? []))
      .catch(() => setBids([]))
      .finally(() => setLoading(false))
  })

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center">
      <div className="bg-white rounded-xl shadow-2xl w-[600px] p-6 animate-fade-up">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-[15px] font-semibold">Bids — {rfq.ref ?? rfq.title}</h2>
          <button onClick={onClose} className="text-ink-3 hover:text-ink"><X size={18} /></button>
        </div>
        {loading ? (
          <div className="text-[13px] text-ink-3 py-6 text-center">Loading bids…</div>
        ) : bids?.length ? (
          <table className="w-full">
            <thead>
              <tr className="border-b border-border">
                {['Vendor', 'Amount', 'Score', 'NC %', 'Status'].map(h => (
                  <th key={h} className="text-left text-[11px] font-medium text-ink-3 px-3 py-2">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {bids.map((b, i) => (
                <tr key={i} className="table-row">
                  <td className="px-3 py-2 text-[13px]">{b.vendorName}</td>
                  <td className="px-3 py-2 font-mono text-[12px]">₦{(b.amount / 1e6).toFixed(1)}M</td>
                  <td className="px-3 py-2 font-medium text-[12.5px]">{b.score ?? '—'}</td>
                  <td className="px-3 py-2 text-[12.5px]">{b.nigerianContentPct ?? '—'}%</td>
                  <td className="px-3 py-2">
                    <StatusBadge status={b.status === 'awarded' ? 'success' : 'pending'} label={b.status ?? 'Submitted'} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div className="text-[13px] text-ink-3 py-8 text-center">No bids received yet</div>
        )}
        <div className="mt-4 flex justify-end">
          <Button variant="outline" onClick={onClose}>Close</Button>
        </div>
      </div>
    </div>
  )
}

// ── Main ───────────────────────────────────────────────────
export default function Sourcing() {
  const [showNewRFQ, setShowNewRFQ] = useState(false)
  const [viewBidsFor, setViewBidsFor] = useState(null)
  const [filterStatus, setFilterStatus] = useState('all')
  const [filterCategory, setFilterCategory] = useState('all')

  const { data: rfqsRaw, isLoading } = useRFQs({
    status: filterStatus !== 'all' ? filterStatus : undefined,
    category: filterCategory !== 'all' ? filterCategory : undefined,
  })

  const rfqs = rfqsRaw?.data ?? rfqsRaw ?? []

  const formatValue = (v) => {
    if (!v) return '—'
    const n = Number(v)
    if (isNaN(n)) return v
    return `₦${(n / 1e6).toFixed(1)}M`
  }

  return (
    <div className="space-y-4">
      <PageHeader title="Sourcing" subtitle="Agent 1.1 — RFQ pipeline · autonomous issuance active">
        <Button variant="primary" onClick={() => setShowNewRFQ(true)}>
          <Plus size={13} /> New RFQ
        </Button>
      </PageHeader>

      {/* Filters */}
      <Card>
        <div className="p-3 border-b border-border flex items-center gap-3">
          <span className="text-[12px] text-ink-3">Filter by:</span>
          <select
            value={filterStatus}
            onChange={e => setFilterStatus(e.target.value)}
            className="border border-border rounded-md px-2.5 py-1.5 text-[12.5px] bg-white font-sans focus:outline-none"
          >
            <option value="all">All Statuses</option>
            <option value="open">Open</option>
            <option value="issued">Issued</option>
            <option value="evaluating">Evaluating</option>
            <option value="awarded">Awarded</option>
            <option value="cancelled">Cancelled</option>
          </select>
          <select
            value={filterCategory}
            onChange={e => setFilterCategory(e.target.value)}
            className="border border-border rounded-md px-2.5 py-1.5 text-[12.5px] bg-white font-sans focus:outline-none"
          >
            <option value="all">All Categories</option>
            {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <span className="ml-auto text-[12px] text-ink-3">{rfqs.length} results</span>
        </div>

        {isLoading ? (
          <div className="py-10 text-center text-ink-3 text-[13px]">Loading RFQs…</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border">
                  {['RFQ Ref', 'Title / Category', 'Vendors Invited', 'Bids Received', 'Est. Value', 'Deadline', 'Status', ''].map(h => (
                    <th key={h} className="text-left text-[11px] font-medium text-ink-3 px-4 py-2 whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rfqs.length === 0 && (
                  <tr>
                    <td colSpan={8} className="px-4 py-10 text-center text-ink-3 text-[13px]">
                      No RFQs found — create one with the button above
                    </td>
                  </tr>
                )}
                {rfqs.map(r => {
                  const { badge, label } = statusInfo(r.status ?? r.statusLabel)
                  return (
                    <tr key={r._id ?? r.ref} className="table-row">
                      <td className="px-4 py-2.5 font-mono text-[12px]">{r.ref ?? r._id}</td>
                      <td className="px-4 py-2.5">
                        <div className="text-[13px]">{r.title}</div>
                        <div className="text-[11px] text-ink-3">{r.category}</div>
                      </td>
                      <td className="px-4 py-2.5 text-[13px]">{r.vendorsInvited ?? r.vendors ?? 0}</td>
                      <td className="px-4 py-2.5 text-[13px]">{r.bidsReceived ?? r.bids ?? 0}</td>
                      <td className="px-4 py-2.5 font-mono text-[12.5px]">
                        {r.value ?? formatValue(r.estimatedValue)}
                      </td>
                      <td className="px-4 py-2.5 text-[12.5px] text-ink-2">{r.deadline}</td>
                      <td className="px-4 py-2.5">
                        <StatusBadge status={badge} label={label} />
                      </td>
                      <td className="px-4 py-2.5">
                        <button
                          onClick={() => setViewBidsFor(r)}
                          className="flex items-center gap-1 text-[11.5px] text-blue-500 hover:text-blue-700 transition-colors"
                        >
                          <Eye size={12} /> Bids
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {showNewRFQ && <NewRFQModal onClose={() => setShowNewRFQ(false)} />}
      {viewBidsFor && <BidsPanel rfq={viewBidsFor} onClose={() => setViewBidsFor(null)} />}
    </div>
  )
}
