import clsx from 'clsx'

// ── Card ─────────────────────────────────────────────────────
export function Card({ children, className = '' }) {
  return <div className={clsx('card animate-fade-up', className)}>{children}</div>
}

export function CardHeader({ title, action }) {
  return (
    <div className="flex items-center justify-between px-4 pt-4 pb-0">
      <span className="text-[13.5px] font-medium text-ink">{title}</span>
      {action && <div className="text-ink-3 cursor-pointer text-sm hover:text-ink">{action}</div>}
    </div>
  )
}

export function CardBody({ children, className = '' }) {
  return <div className={clsx('px-4 py-3', className)}>{children}</div>
}

// ── Stat Card ─────────────────────────────────────────────────
export function StatCard({ label, value, change, changeDir = 'up', active, onClick }) {
  return (
    <div
      className={clsx('stat-card animate-fade-up', active && 'active')}
      onClick={onClick}
    >
      <div className="text-[11.5px] text-ink-3 mb-1">{label}</div>
      <div className="text-[22px] font-medium tracking-tight leading-none">{value}</div>
      <div className="flex items-center gap-1 mt-1.5">
        <span
          className={clsx(
            'px-[5px] py-[1px] rounded text-[11px] font-medium',
            changeDir === 'up' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
          )}
        >
          {change}
        </span>
        <span className="text-[11.5px] text-ink-3">vs prior</span>
      </div>
    </div>
  )
}

// ── Status Badge ──────────────────────────────────────────────
const STATUS_STYLES = {
  success:  'bg-green-100 text-green-800',
  pending:  'bg-amber-100 text-amber-800',
  review:   'bg-blue-100 text-blue-800',
  failed:   'bg-red-100 text-red-800',
  active:   'bg-purple-100 text-purple-800',
  autonomous: 'text-green-600',
  hitl:       'text-amber-500',
}

export function StatusBadge({ status, label }) {
  return (
    <span className={clsx('inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium', STATUS_STYLES[status])}>
      {label}
    </span>
  )
}

// ── Agent Dot ─────────────────────────────────────────────────
export function AgentDot({ status }) {
  return (
    <div
      className={clsx(
        'w-[6px] h-[6px] rounded-full flex-shrink-0',
        status === 'active' && 'bg-green-500',
        status === 'busy' || status === 'monitoring' ? 'bg-amber-400 animate-pulse-dot' : '',
        status === 'idle' && 'bg-ink-3',
        status === 'error' && 'bg-red-500'
      )}
    />
  )
}

// ── Sparkline ─────────────────────────────────────────────────
export function Sparkline({ data, color = '#3b82f6' }) {
  const max = Math.max(...data)
  return (
    <div className="flex items-end gap-[2px] h-6">
      {data.map((v, i) => (
        <div
          key={i}
          className="w-1 rounded-t-[2px] opacity-50 hover:opacity-100 transition-opacity"
          style={{ height: `${(v / max) * 100}%`, background: color }}
        />
      ))}
    </div>
  )
}

// ── KPI Bar Row ───────────────────────────────────────────────
export function KPIRow({ label, value, pct, color }) {
  return (
    <div className="flex items-center justify-between py-1.5 border-b border-border last:border-0">
      <div className="flex items-center gap-1.5 text-[12.5px] text-ink-2">
        <div className="w-2 h-2 rounded-sm flex-shrink-0" style={{ background: color }} />
        {label}
      </div>
      <div className="flex-1 mx-3 h-[3px] rounded-full bg-border overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-1000"
          style={{ width: `${pct}%`, background: color }}
        />
      </div>
      <span className="text-[12px] text-ink-2 min-w-[48px] text-right">{value}</span>
    </div>
  )
}

// ── Agent Badge ───────────────────────────────────────────────
const AGENT_BADGE = {
  sourcing: { bg: '#dbeafe', color: '#1e40af' },
  bid_eval: { bg: '#f3e8ff', color: '#6b21a8' },
  po_exec: { bg: '#d1fae5', color: '#065f46' },
  contract: { bg: '#ffedd5', color: '#9a3412' },
  vendor_mgmt: { bg: '#fce7f3', color: '#9d174d' },
  orchestrator: { bg: '#f1f5f9', color: '#475569' },
}

export function AgentBadge({ agent, label }) {
  const style = AGENT_BADGE[agent] || AGENT_BADGE.orchestrator
  return (
    <span
      className="px-[5px] py-[1px] rounded text-[10.5px] font-medium flex-shrink-0"
      style={{ background: style.bg, color: style.color }}
    >
      {label}
    </span>
  )
}

// ── Button ────────────────────────────────────────────────────
export function Button({ children, variant = 'primary', size = 'md', onClick, className = '' }) {
  return (
    <button
      className={clsx(
        'btn',
        variant === 'primary' && 'btn-primary',
        variant === 'outline' && 'btn-outline',
        size === 'sm' && 'text-xs px-2.5 py-1',
        className
      )}
      onClick={onClick}
    >
      {children}
    </button>
  )
}

// ── Page Header ───────────────────────────────────────────────
export function PageHeader({ title, subtitle, children }) {
  return (
    <div className="flex items-start justify-between mb-5">
      <div>
        <h1 className="text-[24px] font-medium tracking-tight leading-tight">{title}</h1>
        {subtitle && <p className="text-[13px] text-ink-2 mt-0.5">{subtitle}</p>}
      </div>
      {children && <div className="flex items-center gap-2">{children}</div>}
    </div>
  )
}

// ── Empty State ───────────────────────────────────────────────
export function EmptyState({ icon, title, description }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <div className="text-4xl mb-3">{icon}</div>
      <div className="text-[14px] font-medium text-ink">{title}</div>
      <div className="text-[12.5px] text-ink-3 mt-1">{description}</div>
    </div>
  )
}
