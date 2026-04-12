import { useState } from 'react'
import { Outlet, NavLink } from 'react-router-dom'
import { Layers, ChevronDown } from 'lucide-react'
import { useStore } from '../../context/store'
import { useSocket } from '../../context/SocketContext'
import { useDashboardStats, useRFQs, useHITLQueue } from '../../hooks'
import clsx from 'clsx'

const NAV_LINKS = [
  { to: '/',         label: 'Overview',  exact: true },
  { to: '/agents',   label: 'Agents' },
  { to: '/sourcing', label: 'Sourcing' },
  { to: '/contracts',label: 'Contracts' },
  { to: '/vendors',  label: 'Vendors' },
  { to: '/audit',    label: 'Audit Log' },
]

// ── Date Range Picker (simple) ─────────────────────────────
function DateRangePicker() {
  const [open, setOpen] = useState(false)
  const { dateRange, setDateRange } = useStore()

  const presets = [
    { label: 'Q1 2025', from: 'Jan 01', to: 'Mar 31' },
    { label: 'Q2 2025', from: 'Apr 01', to: 'Jun 30' },
    { label: 'H1 2025', from: 'Jan 01', to: 'Jun 30' },
    { label: 'YTD',     from: 'Jan 01', to: 'Jul 31' },
  ]

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-1.5 px-3 py-1.5 border border-border rounded-md text-[12.5px] text-ink-2 hover:border-border-2 transition-colors"
      >
        📅 {dateRange.from} – {dateRange.to} <ChevronDown size={12} />
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1 bg-white border border-border rounded-lg shadow-lg z-50 w-[160px]">
          {presets.map(p => (
            <button
              key={p.label}
              onClick={() => { setDateRange({ from: p.from, to: p.to }); setOpen(false) }}
              className={clsx(
                'w-full text-left px-3 py-2 text-[12.5px] hover:bg-surface-2 transition-colors',
                dateRange.from === p.from && dateRange.to === p.to && 'bg-surface-2 font-medium'
              )}
            >
              {p.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Sidebar ────────────────────────────────────────────────
function Sidebar({ hitlCount, rfqCount }) {
  const SIDEBAR_ITEMS = [
    { section: 'Procurement', items: [
      { to: '/',           label: 'Overview',    color: '#3b82f6', end: true },
      { to: '/sourcing',   label: 'RFQ Pipeline',color: '#8b5cf6', badge: rfqCount > 0 ? rfqCount : null, badgeColor: '#8b5cf6' },
      { to: '/sourcing',   label: 'Active POs',  color: '#10b981', end: false },
      { to: '/contracts',  label: 'Contracts',   color: '#f97316' },
      { to: '/vendors',    label: 'Vendors',     color: '#ec4899' },
    ]},
    { section: 'Agents', items: [
      { to: '/agents',     label: 'Sourcing 1',    color: '#3b82f6' },
      { to: '/agents',     label: 'Bid Eval 2',    color: '#8b5cf6' },
      { to: '/agents',     label: 'PO Exec 3',     color: '#10b981' },
      { to: '/agents',     label: 'Contract 4',    color: '#f97316' },
      { to: '/agents',     label: 'Vendor Mgmt 5', color: '#ec4899' },
    ]},
    { section: 'Oversight', items: [
      { to: '/hitl',       label: 'HITL Queue',  color: '#ef4444', badge: hitlCount > 0 ? hitlCount : null, badgeColor: '#ef4444' },
      { to: '/audit',      label: 'Audit Trail', color: '#9c9a94' },
    ]},
    { section: 'Config', items: [
      { to: '/agents',     label: 'Thresholds',  color: '#9c9a94' },
      { to: '/agents',     label: 'Tool Config', color: '#9c9a94' },
    ]},
  ]

  return (
    <aside className="w-[210px] bg-white border-r border-border flex flex-col gap-0.5 px-2 py-3 flex-shrink-0 overflow-y-auto">
      {SIDEBAR_ITEMS.map((section) => (
        <div key={section.section}>
          <div className="text-[10.5px] font-medium text-ink-3 uppercase tracking-[0.6px] px-2 py-2 mt-1">
            {section.section}
          </div>
          {section.items.map((item) => (
            <NavLink
              key={item.label}
              to={item.to}
              end={item.end !== false}
              className={({ isActive }) =>
                clsx('sidebar-item', isActive && 'active')
              }
            >
              <div
                className="w-[6px] h-[6px] rounded-full flex-shrink-0"
                style={{ background: item.color }}
              />
              <span className="flex-1 truncate">{item.label}</span>
              {item.badge != null && (
                <span
                  className="ml-auto rounded-[10px] px-[5px] py-[1px] text-[10px] font-semibold text-white"
                  style={{ background: item.badgeColor || '#ef4444' }}
                >
                  {item.badge}
                </span>
              )}
            </NavLink>
          ))}
          <div className="h-px bg-border my-1.5" />
        </div>
      ))}
    </aside>
  )
}

// ── Layout ─────────────────────────────────────────────────
export default function Layout() {
  const { connected } = useSocket()

  // Live badge counts
  const { data: stats } = useDashboardStats()
  const { data: rfqsRaw } = useRFQs({ status: 'open' })
  const { data: hitlRaw } = useHITLQueue()

  const hitlCount = hitlRaw?.data?.length ?? hitlRaw?.length ?? stats?.hitlPending ?? 0
  const rfqCount  = rfqsRaw?.total ?? rfqsRaw?.data?.length ?? rfqsRaw?.length ?? 0

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-surface-3">
      {/* NAVBAR */}
      <nav className="bg-white border-b border-border h-[52px] flex items-center px-4 gap-1 flex-shrink-0 z-50">
        <div className="flex items-center gap-2 mr-6">
          <div className="w-[28px] h-[28px] bg-ink rounded-[7px] flex items-center justify-center flex-shrink-0">
            <Layers size={14} className="text-amber-400" />
          </div>
          <span className="font-semibold text-[15px] tracking-tight">ProcureIQ</span>
        </div>

        <div className="flex items-center gap-0.5 flex-1">
          {NAV_LINKS.map((link) => (
            <NavLink
              key={link.to + link.label}
              to={link.to}
              end={link.exact}
              className={({ isActive }) =>
                clsx('nav-link text-[13.5px]', isActive && 'active')
              }
            >
              {link.label}
              {link.label === 'HITL' && hitlCount > 0 && (
                <span className="ml-1 bg-red-500 text-white text-[10px] font-bold px-1 rounded-full">
                  {hitlCount}
                </span>
              )}
            </NavLink>
          ))}
        </div>

        <div className="flex items-center gap-2 ml-auto">
          <DateRangePicker />
          {/* Live indicator */}
          <div className="flex items-center gap-1.5 px-2">
            <div className={clsx('w-2 h-2 rounded-full', connected ? 'bg-green-500 animate-pulse' : 'bg-ink-3')} />
            <span className="text-[11px] text-ink-3">{connected ? 'Live' : 'Offline'}</span>
          </div>
          <div className="w-[28px] h-[28px] rounded-full bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center text-[11px] font-bold text-white cursor-pointer">
            FA
          </div>
        </div>
      </nav>

      <div className="flex flex-1 overflow-hidden">
        <Sidebar hitlCount={hitlCount} rfqCount={rfqCount} />
        <main className="flex-1 overflow-y-auto p-6">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
