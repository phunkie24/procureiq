import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'
import { dashboardApi, agentsApi, rfqApi, contractsApi, vendorsApi, hitlApi, auditApi } from '../api'
import { useSocket } from '../context/SocketContext'
import { useStore } from '../context/store'

// ── Dashboard ──────────────────────────────────────────────
export function useDashboardStats() {
  return useQuery({
    queryKey: ['dashboard', 'stats'],
    queryFn: dashboardApi.getStats,
    refetchInterval: 30_000,
    placeholderData: {
      rfqsInitiated: 142, bidsReceived: 387, awardsMade: 118,
      posIssued: 104, completed: 89, totalSpendNGN: 41500000000,
      hitlPending: 4, agentsActive: 5, nigerianContentAvg: 75,
    },
  })
}

export function usePipelineData() {
  return useQuery({
    queryKey: ['dashboard', 'pipeline'],
    queryFn: dashboardApi.getPipelineData,
    staleTime: 60_000,
  })
}

export function useSpendData() {
  return useQuery({
    queryKey: ['dashboard', 'spend'],
    queryFn: dashboardApi.getSpendData,
    staleTime: 60_000,
  })
}

// ── Agents ────────────────────────────────────────────────
export function useAgents() {
  return useQuery({
    queryKey: ['agents'],
    queryFn: agentsApi.getAll,
    refetchInterval: 15_000,
  })
}

export function useAgent(id) {
  return useQuery({
    queryKey: ['agents', id],
    queryFn: () => agentsApi.getById(id),
    enabled: !!id,
  })
}

// ── RFQs ─────────────────────────────────────────────────
export function useRFQs(params) {
  return useQuery({
    queryKey: ['rfqs', params],
    queryFn: () => rfqApi.getAll(params),
    staleTime: 30_000,
  })
}

export function useCreateRFQ() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: rfqApi.create,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['rfqs'] }),
  })
}

// ── Contracts ─────────────────────────────────────────────
export function useContracts(params) {
  return useQuery({
    queryKey: ['contracts', params],
    queryFn: () => contractsApi.getAll(params),
    staleTime: 60_000,
  })
}

// ── Vendors ───────────────────────────────────────────────
export function useVendors(params) {
  return useQuery({
    queryKey: ['vendors', params],
    queryFn: () => vendorsApi.getAll(params),
    staleTime: 60_000,
  })
}

// ── HITL Queue ────────────────────────────────────────────
export function useHITLQueue() {
  const qc = useQueryClient()
  const { socket } = useSocket()

  const query = useQuery({
    queryKey: ['hitl'],
    queryFn: hitlApi.getQueue,
    refetchInterval: 10_000,
  })

  const resolve = useMutation({
    mutationFn: ({ id, approved, notes }) => hitlApi.resolve(id, approved, notes),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['hitl'] }),
  })

  // Listen for real-time HITL events
  useEffect(() => {
    if (!socket) return
    socket.on('hitl:new', () => qc.invalidateQueries({ queryKey: ['hitl'] }))
    socket.on('hitl:resolved', () => qc.invalidateQueries({ queryKey: ['hitl'] }))
    return () => { socket.off('hitl:new'); socket.off('hitl:resolved') }
  }, [socket, qc])

  return { ...query, resolve: resolve.mutate }
}

// ── Audit Log ─────────────────────────────────────────────
export function useAuditLog(params) {
  return useQuery({
    queryKey: ['audit', params],
    queryFn: () => auditApi.getLog(params),
    refetchInterval: 5_000,
  })
}

// ── Live audit stream from Socket.io ──────────────────────
export function useLiveAuditStream() {
  const addEntry = useStore((s) => s.addAuditEntry)
  const { lastEvent } = useSocket()

  useEffect(() => {
    if (!lastEvent) return
    // Always use local time — backend sends UTC which is 1 hr behind for WAT (UTC+1)
    const localTime = new Date().toLocaleTimeString('en-GB', {
      hour: '2-digit', minute: '2-digit', second: '2-digit',
    })
    addEntry({
      time: localTime,
      agentId: lastEvent.agentId,
      agentLabel: lastEvent.agentLabel,
      message: lastEvent.message,
      isAuto: lastEvent.isAuto,
      timestamp: lastEvent.timestamp,
    })
  }, [lastEvent, addEntry])
}
