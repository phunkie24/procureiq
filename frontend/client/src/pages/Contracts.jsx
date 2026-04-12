import { useState } from 'react'
import { PageHeader, Card, StatusBadge, Button } from '../components/ui'
import { useContracts } from '../hooks'
import { contractsApi } from '../api'
import { X, FileEdit, Activity } from 'lucide-react'
import clsx from 'clsx'

// ── Risk badge colour ──────────────────────────────────────
function riskColor(score) {
  if (score > 6) return 'text-red-600'
  if (score > 4) return 'text-amber-600'
  return 'text-green-600'
}

function daysColor(days) {
  if (days < 30) return 'text-red-600'
  if (days < 60) return 'text-amber-600'
  return 'text-green-600'
}

function statusInfo(risk) {
  const r = parseFloat(risk)
  if (r > 6) return { badge: 'failed',  label: 'High Risk' }
  if (r > 4) return { badge: 'pending', label: 'Medium Risk' }
  return { badge: 'success', label: 'Low Risk' }
}

// ── Draft Amendment Modal ─────────────────────────────────
function AmendmentModal({ contract, onClose }) {
  const [changes, setChanges] = useState('')
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)

  const handleSubmit = async () => {
    if (!changes.trim()) return
    setLoading(true)
    try {
      await contractsApi.draftAmendment(contract._id ?? contract.ref, changes)
      setDone(true)
    } catch {
      alert('Failed to draft amendment — try again')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center">
      <div className="bg-white rounded-xl shadow-2xl w-[480px] p-6 animate-fade-up">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-[15px] font-semibold">Draft Amendment</h2>
          <button onClick={onClose} className="text-ink-3 hover:text-ink"><X size={18} /></button>
        </div>
        <div className="text-[12.5px] text-ink-2 mb-4">
          Contract: <strong>{contract.ref}</strong> · {contract.vendor ?? contract.vendorName}
        </div>
        {done ? (
          <div className="text-center py-8">
            <div className="text-[32px] mb-2">✓</div>
            <div className="text-[14px] font-medium mb-1">Amendment Drafted</div>
            <div className="text-[12.5px] text-ink-3">Agent 1.4 will review and send for approval</div>
            <Button variant="primary" onClick={onClose} className="mt-4">Close</Button>
          </div>
        ) : (
          <>
            <div>
              <label className="text-[12px] text-ink-2 mb-1 block">Requested Changes</label>
              <textarea
                className="w-full border border-border rounded-md px-3 py-2 text-[13px] focus:outline-none focus:border-border-2 h-28 resize-none"
                placeholder="Describe the contract changes required (e.g. extend term by 90 days, adjust payment schedule)…"
                value={changes}
                onChange={e => setChanges(e.target.value)}
              />
            </div>
            <div className="flex gap-2 mt-5">
              <Button variant="primary" onClick={handleSubmit} disabled={loading} className="flex-1">
                {loading ? 'Drafting…' : 'Send to Agent 1.4'}
              </Button>
              <Button variant="outline" onClick={onClose}>Cancel</Button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

// ── Main ───────────────────────────────────────────────────
export default function Contracts() {
  const [filterRisk, setFilterRisk] = useState('all')
  const [filterStatus, setFilterStatus] = useState('all')
  const [amendTarget, setAmendTarget] = useState(null)
  const [monitoring, setMonitoring] = useState(false)

  const { data: contractsRaw, isLoading, refetch } = useContracts({
    risk: filterRisk !== 'all' ? filterRisk : undefined,
  })

  const allContracts = contractsRaw?.data ?? contractsRaw ?? []

  // Client-side status filter (risk is handled server-side)
  const contracts = filterStatus === 'all'
    ? allContracts
    : allContracts.filter(c => {
        const risk = parseFloat(c.nlpRiskScore ?? c.risk ?? 0)
        if (filterStatus === 'high')   return risk > 6
        if (filterStatus === 'medium') return risk > 4 && risk <= 6
        if (filterStatus === 'low')    return risk <= 4
        return true
      })

  const handleMonitorAll = async () => {
    setMonitoring(true)
    try {
      await contractsApi.monitor()
      alert('Contract monitoring scan triggered — Agent 1.4 will report within 2 minutes')
    } catch {
      alert('Monitor request failed — agent may be offline')
    } finally {
      setMonitoring(false)
    }
  }

  const expiryAlerts = allContracts.filter(c => {
    const d = parseInt(c.daysRemaining ?? c.days ?? 999)
    return d < 60
  }).length

  return (
    <div className="space-y-4">
      <PageHeader
        title="Contracts"
        subtitle={`Agent 1.4 — NLP risk monitoring · ${expiryAlerts} expiry alert${expiryAlerts !== 1 ? 's' : ''}`}
      >
        <Button variant="outline" onClick={handleMonitorAll} disabled={monitoring}>
          <Activity size={13} /> {monitoring ? 'Scanning…' : 'Monitor All'}
        </Button>
      </PageHeader>

      <Card>
        {/* Filters */}
        <div className="p-3 border-b border-border flex items-center gap-3">
          <span className="text-[12px] text-ink-3">Filter:</span>
          <select
            value={filterStatus}
            onChange={e => setFilterStatus(e.target.value)}
            className="border border-border rounded-md px-2.5 py-1.5 text-[12.5px] bg-white font-sans focus:outline-none"
          >
            <option value="all">All Risk Levels</option>
            <option value="high">High Risk (&gt;6)</option>
            <option value="medium">Medium Risk (4–6)</option>
            <option value="low">Low Risk (&lt;4)</option>
          </select>
          <select
            value={filterRisk}
            onChange={e => setFilterRisk(e.target.value)}
            className="border border-border rounded-md px-2.5 py-1.5 text-[12.5px] bg-white font-sans focus:outline-none"
          >
            <option value="all">All Statuses</option>
            <option value="active">Active</option>
            <option value="expiring">Expiring Soon</option>
            <option value="expired">Expired</option>
          </select>
          <span className="ml-auto text-[12px] text-ink-3">{contracts.length} contracts</span>
        </div>

        {isLoading ? (
          <div className="py-10 text-center text-ink-3 text-[13px]">Loading contracts…</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border">
                  {['Contract Ref', 'Vendor', 'Value', 'Expiry', 'Days Remaining', 'NLP Risk Score', 'Status', ''].map(h => (
                    <th key={h} className="text-left text-[11px] font-medium text-ink-3 px-4 py-2 whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {contracts.length === 0 && (
                  <tr>
                    <td colSpan={8} className="px-4 py-10 text-center text-ink-3 text-[13px]">
                      No contracts match the current filters
                    </td>
                  </tr>
                )}
                {contracts.map(c => {
                  const risk = parseFloat(c.nlpRiskScore ?? c.risk ?? 0)
                  const days = parseInt(c.daysRemaining ?? c.days ?? 999)
                  const { badge, label } = statusInfo(risk)
                  return (
                    <tr key={c._id ?? c.ref} className="table-row">
                      <td className="px-4 py-2.5 font-mono text-[12px]">{c.ref ?? c._id}</td>
                      <td className="px-4 py-2.5 text-[13px]">{c.vendor ?? c.vendorName}</td>
                      <td className="px-4 py-2.5 font-mono text-[12.5px]">{c.value ?? c.contractValue}</td>
                      <td className="px-4 py-2.5 text-[12.5px] text-ink-2">{c.expiryDate ?? c.end}</td>
                      <td className="px-4 py-2.5">
                        <span className={clsx('font-medium text-[12.5px]', daysColor(days))}>
                          {days}d
                        </span>
                      </td>
                      <td className="px-4 py-2.5">
                        <span className={clsx('font-mono text-[12.5px] font-medium', riskColor(risk))}>
                          {risk.toFixed(1)}/10
                        </span>
                      </td>
                      <td className="px-4 py-2.5">
                        <StatusBadge status={badge} label={label} />
                      </td>
                      <td className="px-4 py-2.5">
                        <button
                          onClick={() => setAmendTarget(c)}
                          className="flex items-center gap-1 text-[11.5px] text-ink-2 hover:text-blue-600 transition-colors"
                        >
                          <FileEdit size={12} /> Amend
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

      {amendTarget && <AmendmentModal contract={amendTarget} onClose={() => setAmendTarget(null)} />}
    </div>
  )
}
