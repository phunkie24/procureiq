import { Routes, Route } from 'react-router-dom'
import Layout from './components/layout/Layout'
import Overview from './pages/Overview'
import Agents from './pages/Agents'
import Sourcing from './pages/Sourcing'
import Contracts from './pages/Contracts'
import Vendors from './pages/Vendors'
import AuditLog from './pages/AuditLog'
import HITLPage from './pages/HITLPage'
import { SocketProvider } from './context/SocketContext'

export default function App() {
  return (
    <SocketProvider>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<Overview />} />
          <Route path="agents" element={<Agents />} />
          <Route path="sourcing" element={<Sourcing />} />
          <Route path="contracts" element={<Contracts />} />
          <Route path="vendors" element={<Vendors />} />
          <Route path="hitl" element={<HITLPage />} />
          <Route path="audit" element={<AuditLog />} />
        </Route>
      </Routes>
    </SocketProvider>
  )
}
