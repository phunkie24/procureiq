import { create } from 'zustand'

export const useStore = create((set, get) => ({
  // HITL queue
  hitlQueue: [],
  addHITL: (item) => set((s) => ({ hitlQueue: [item, ...s.hitlQueue] })),
  resolveHITL: (id, approved, actor) =>
    set((s) => ({
      hitlQueue: s.hitlQueue.filter((h) => h._id !== id),
    })),

  // Audit log
  auditLog: [],
  addAuditEntry: (entry) =>
    set((s) => ({ auditLog: [entry, ...s.auditLog].slice(0, 100) })),

  // Agent statuses
  agentStatuses: {
    sourcing: 'active',
    bid_eval: 'active',
    po_exec: 'active',
    contract: 'monitoring',
    vendor_mgmt: 'active',
  },
  setAgentStatus: (agent, status) =>
    set((s) => ({ agentStatuses: { ...s.agentStatuses, [agent]: status } })),

  // Date range
  dateRange: { from: 'Jan 01', to: 'Jul 31' },
  setDateRange: (range) => set({ dateRange: range }),

  // Active nav
  activePage: 'overview',
  setActivePage: (page) => set({ activePage: page }),
}))
