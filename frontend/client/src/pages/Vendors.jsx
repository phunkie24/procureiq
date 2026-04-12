import { useState } from 'react'
import { PageHeader, Card, StatusBadge, Button } from '../components/ui'
import { useVendors } from '../hooks'
import { vendorsApi } from '../api'
import { Plus, Search, X, Compass } from 'lucide-react'
import clsx from 'clsx'

const CATEGORIES = ['Mechanical', 'Electrical', 'IT Equipment', 'Services', 'Civil', 'Chemicals', 'Drilling', 'Subsea']

function ncColor(pct) {
  return pct >= 70 ? 'text-green-600' : 'text-amber-600'
}

function statusInfo(s) {
  const map = {
    strategic_partner: { badge: 'success', label: 'Strategic Partner' },
    active:            { badge: 'success', label: 'Active' },
    probation:         { badge: 'failed',  label: 'Probation' },
    under_review:      { badge: 'pending', label: 'Under Review' },
    suspended:         { badge: 'failed',  label: 'Suspended' },
    new:               { badge: 'review',  label: 'New' },
  }
  return map[s?.toLowerCase().replace(/\s+/g, '_')] ?? { badge: 'pending', label: s ?? 'Active' }
}

// ── Discover Vendors Modal ─────────────────────────────────
function DiscoverModal({ onClose }) {
  const [category, setCategory] = useState(CATEGORIES[0])
  const [loading, setLoading] = useState(false)
  const [results, setResults] = useState(null)

  const handleSearch = async () => {
    setLoading(true)
    try {
      const data = await vendorsApi.discover(category)
      setResults(data?.candidates ?? data?.data ?? [])
    } catch {
      alert('Market discovery failed — try again')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center">
      <div className="bg-white rounded-xl shadow-2xl w-[560px] p-6 animate-fade-up">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-[15px] font-semibold">Discover Vendors</h2>
          <button onClick={onClose} className="text-ink-3 hover:text-ink"><X size={18} /></button>
        </div>
        <div className="flex gap-2 mb-4">
          <select
            value={category}
            onChange={e => setCategory(e.target.value)}
            className="flex-1 border border-border rounded-md px-3 py-2 text-[13px] bg-white focus:outline-none"
          >
            {CATEGORIES.map(c => <option key={c}>{c}</option>)}
          </select>
          <Button variant="primary" onClick={handleSearch} disabled={loading}>
            <Compass size={13} /> {loading ? 'Searching…' : 'Search Market'}
          </Button>
        </div>
        {results !== null && (
          results.length > 0 ? (
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {results.map((v, i) => (
                <div key={i} className="border border-border rounded-lg p-3">
                  <div className="font-medium text-[13px]">{v.name}</div>
                  {v.description && (
                    <div className="text-[11.5px] text-ink-3 mt-0.5 line-clamp-2">{v.description}</div>
                  )}
                  <div className="flex gap-3 mt-1.5 text-[11.5px] text-ink-2">
                    <span>NC: <strong>{Math.round(v.nigerian_content_pct ?? 0)}%</strong></span>
                    <span>Rating: <strong>{v.financial_rating ?? '—'}</strong></span>
                    <span>LTIR: <strong>{v.safety_ltir ?? '—'}</strong></span>
                    <span className="text-ink-3">{v.data_source}</span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-6 text-ink-3 text-[13px]">No candidates found</div>
          )
        )}
        <div className="mt-4 flex justify-end">
          <Button variant="outline" onClick={onClose}>Close</Button>
        </div>
      </div>
    </div>
  )
}

// ── Onboard Vendor Modal ───────────────────────────────────
function OnboardModal({ onClose }) {
  const [form, setForm] = useState({
    name: '', category: CATEGORIES[0], rcNumber: '', contactEmail: '',
    nigerianContentPct: '', address: '',
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)

  const set = (k, v) => setForm(p => ({ ...p, [k]: v }))

  const handleSubmit = async () => {
    if (!form.name || !form.contactEmail) {
      setError('Name and contact email are required.')
      return
    }
    setLoading(true)
    setError('')
    try {
      await vendorsApi.onboard(form)
      setDone(true)
    } catch (e) {
      setError(e?.message ?? 'Onboarding failed — try again')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center">
      <div className="bg-white rounded-xl shadow-2xl w-[500px] p-6 animate-fade-up">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-[15px] font-semibold">Onboard Vendor</h2>
          <button onClick={onClose} className="text-ink-3 hover:text-ink"><X size={18} /></button>
        </div>

        {done ? (
          <div className="text-center py-8">
            <div className="text-[32px] mb-2">✓</div>
            <div className="text-[14px] font-medium mb-1">Onboarding Submitted</div>
            <div className="text-[12.5px] text-ink-3">Agent 1.5 will verify compliance and add to vendor register</div>
            <Button variant="primary" onClick={onClose} className="mt-4">Close</Button>
          </div>
        ) : (
          <>
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 text-[12.5px] px-3 py-2 rounded-md mb-4">{error}</div>
            )}
            <div className="space-y-3">
              <div>
                <label className="text-[12px] text-ink-2 mb-1 block">Vendor Name *</label>
                <input
                  className="w-full border border-border rounded-md px-3 py-2 text-[13px] focus:outline-none"
                  value={form.name}
                  onChange={e => set('name', e.target.value)}
                  placeholder="e.g. Coastal Supplies Ltd"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[12px] text-ink-2 mb-1 block">Category</label>
                  <select
                    className="w-full border border-border rounded-md px-3 py-2 text-[13px] bg-white focus:outline-none"
                    value={form.category}
                    onChange={e => set('category', e.target.value)}
                  >
                    {CATEGORIES.map(c => <option key={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-[12px] text-ink-2 mb-1 block">RC Number</label>
                  <input
                    className="w-full border border-border rounded-md px-3 py-2 text-[13px] focus:outline-none"
                    value={form.rcNumber}
                    onChange={e => set('rcNumber', e.target.value)}
                    placeholder="RC-123456"
                  />
                </div>
              </div>
              <div>
                <label className="text-[12px] text-ink-2 mb-1 block">Contact Email *</label>
                <input
                  type="email"
                  className="w-full border border-border rounded-md px-3 py-2 text-[13px] focus:outline-none"
                  value={form.contactEmail}
                  onChange={e => set('contactEmail', e.target.value)}
                  placeholder="vendor@company.com"
                />
              </div>
              <div>
                <label className="text-[12px] text-ink-2 mb-1 block">Nigerian Content % (declared)</label>
                <input
                  type="number"
                  className="w-full border border-border rounded-md px-3 py-2 text-[13px] focus:outline-none"
                  value={form.nigerianContentPct}
                  onChange={e => set('nigerianContentPct', e.target.value)}
                  placeholder="e.g. 65"
                />
              </div>
            </div>
            <div className="flex gap-2 mt-5">
              <Button variant="primary" onClick={handleSubmit} disabled={loading} className="flex-1">
                {loading ? 'Submitting…' : 'Submit for Onboarding'}
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
export default function Vendors() {
  const [filterStatus, setFilterStatus] = useState('all')
  const [search, setSearch] = useState('')
  const [showDiscover, setShowDiscover] = useState(false)
  const [showOnboard, setShowOnboard] = useState(false)

  const { data: vendorsRaw, isLoading } = useVendors({
    status: filterStatus !== 'all' ? filterStatus : undefined,
  })

  const allVendors = vendorsRaw?.data ?? vendorsRaw ?? []

  const vendors = allVendors.filter(v => {
    if (!search) return true
    const q = search.toLowerCase()
    return (
      (v.name ?? '').toLowerCase().includes(q) ||
      (v.code ?? '').toLowerCase().includes(q) ||
      (v.category ?? '').toLowerCase().includes(q)
    )
  })

  return (
    <div className="space-y-4">
      <PageHeader title="Vendors" subtitle={`Agent 1.5 · ${allVendors.length} loaded · filter by status below`}>
        <Button variant="outline" onClick={() => setShowDiscover(true)}>
          <Compass size={13} /> Discover New
        </Button>
        <Button variant="primary" onClick={() => setShowOnboard(true)}>
          <Plus size={13} /> Onboard Vendor
        </Button>
      </PageHeader>

      <Card>
        {/* Filters + search */}
        <div className="p-3 border-b border-border flex items-center gap-3">
          <div className="relative flex-1 max-w-[280px]">
            <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-3" />
            <input
              className="w-full border border-border rounded-md pl-7 pr-3 py-1.5 text-[12.5px] focus:outline-none focus:border-border-2"
              placeholder="Search vendors…"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          <select
            value={filterStatus}
            onChange={e => setFilterStatus(e.target.value)}
            className="border border-border rounded-md px-2.5 py-1.5 text-[12.5px] bg-white font-sans focus:outline-none"
          >
            <option value="all">All Statuses</option>
            <option value="strategic_partner">Strategic Partner</option>
            <option value="active">Active</option>
            <option value="probation">Probation</option>
            <option value="under_review">Under Review</option>
            <option value="new">New</option>
          </select>
          <span className="ml-auto text-[12px] text-ink-3">{vendors.length} vendors</span>
        </div>

        {isLoading ? (
          <div className="py-10 text-center text-ink-3 text-[13px]">Loading vendors…</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border">
                  {['Vendor', 'Code', 'Category', 'Performance Score', 'Nigerian Content %', 'Status'].map(h => (
                    <th key={h} className="text-left text-[11px] font-medium text-ink-3 px-4 py-2">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {vendors.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-4 py-10 text-center text-ink-3 text-[13px]">
                      No vendors found
                    </td>
                  </tr>
                )}
                {vendors.map(v => {
                  const score = v.performanceScore ?? v.score ?? 0
                  const nc = v.nigerianContentPct ?? v.nc ?? 0
                  const { badge, label } = statusInfo(v.status ?? v.statusLabel)
                  return (
                    <tr key={v._id ?? v.code} className="table-row">
                      <td className="px-4 py-2.5 font-medium text-[13px]">{v.name}</td>
                      <td className="px-4 py-2.5 font-mono text-[12px] text-ink-2">{v.code ?? v._id}</td>
                      <td className="px-4 py-2.5 text-[12.5px] text-ink-2">{v.category}</td>
                      <td className="px-4 py-2.5">
                        <div className="flex items-center gap-2">
                          <div className="flex-1 h-1.5 bg-border rounded-full overflow-hidden max-w-[80px]">
                            <div className="h-full bg-blue-400 rounded-full" style={{ width: `${score}%` }} />
                          </div>
                          <span className="font-medium text-[12.5px]">{score}</span>
                        </div>
                      </td>
                      <td className="px-4 py-2.5">
                        <span className={clsx('font-medium text-[12.5px]', ncColor(nc))}>{nc}%</span>
                      </td>
                      <td className="px-4 py-2.5">
                        <StatusBadge status={badge} label={label} />
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {showDiscover && <DiscoverModal onClose={() => setShowDiscover(false)} />}
      {showOnboard && <OnboardModal onClose={() => setShowOnboard(false)} />}
    </div>
  )
}
