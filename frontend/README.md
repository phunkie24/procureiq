# ProcureIQ — Procurement Agent Squadron
## MERN Stack Dashboard + Python Agent Backend

Full-stack enterprise procurement AI system. React + Vite frontend, Express/MongoDB backend, Python multi-agent system.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18 + Vite + TailwindCSS + Recharts |
| State | Zustand + React Query (TanStack) |
| Routing | React Router v6 |
| Backend | Node.js + Express 4 |
| Database | MongoDB + Mongoose |
| Real-time | Socket.io |
| HTTP | Axios |
| Icons | Lucide React |
| Agent Backend | Python 3.11 + Anthropic SDK |
| All open-source | ✓ |

---

## Project Structure

```
procureiq/
├── client/                    # React frontend (Vite)
│   ├── src/
│   │   ├── api/index.js       # Axios API client
│   │   ├── components/
│   │   │   ├── layout/        # Navbar + Sidebar + Outlet
│   │   │   └── ui.jsx         # Shared UI components
│   │   ├── context/
│   │   │   ├── SocketContext.jsx   # Socket.io real-time
│   │   │   └── store.js           # Zustand global state
│   │   ├── hooks/index.js     # React Query data hooks
│   │   └── pages/             # Route-level page components
│   │       ├── Overview.jsx   # Main dashboard
│   │       ├── Agents.jsx     # Agent status + metrics
│   │       ├── Sourcing.jsx   # RFQ pipeline
│   │       ├── Contracts.jsx  # Contract monitoring
│   │       ├── Vendors.jsx    # Vendor performance
│   │       ├── HITLPage.jsx   # Human oversight queue
│   │       └── AuditLog.jsx   # Immutable audit trail
│   └── package.json
│
├── server/                    # Express API + Socket.io
│   ├── index.js               # Entry point + Socket.io setup
│   ├── config/
│   │   ├── db.js              # MongoDB connection
│   │   └── logger.js          # Winston structured logging
│   ├── middleware/
│   │   ├── errorHandler.js
│   │   └── rateLimiter.js
│   ├── models/index.js        # All Mongoose schemas
│   ├── routes/                # Express routers
│   │   ├── dashboard.js
│   │   ├── agents.js
│   │   ├── rfqs.js
│   │   ├── bids.js
│   │   ├── purchaseOrders.js
│   │   ├── contracts.js
│   │   ├── vendors.js
│   │   ├── hitl.js
│   │   └── audit.js
│   └── services/
│       ├── MockDataService.js    # In-memory fallback data
│       └── AgentEventService.js  # Socket.io event simulation
│
└── procurement_agents/        # Python agent system (from previous build)
    ├── agents/                # All 5 agent implementations
    ├── orchestrator/
    ├── tools/
    ├── memory/
    ├── state/
    ├── guardrails/
    └── evaluation/
```

---

## Quick Start

### 1. Install dependencies
```bash
# Root
npm install

# Client
cd client && npm install

# Server
cd ../server && npm install
```

### 2. Configure environment
```bash
cp server/.env.example server/.env
# Edit server/.env — set MONGODB_URI if you have MongoDB
# Server works without MongoDB using built-in mock data
```

### 3. Run development servers
```bash
# From root — starts both client (3000) and server (5000) concurrently
npm run dev

# Or separately:
npm run client   # React on http://localhost:3000
npm run server   # Express on http://localhost:5000
```

### 4. Python agent backend (optional)
```bash
cd procurement_agents
pip install -r requirements.txt
cp .env.example .env  # add ANTHROPIC_API_KEY
python -m main
```

---

## API Endpoints

| Method | Endpoint | Description |
|---|---|---|
| GET | /api/health | Health check |
| GET | /api/dashboard/stats | KPI summary |
| GET | /api/dashboard/pipeline | Monthly pipeline data |
| GET | /api/dashboard/spend | Spend by category |
| GET | /api/agents | All agent statuses + metrics |
| GET | /api/agents/:id | Single agent details |
| POST | /api/agents/:id/tasks | Trigger agent task |
| GET | /api/rfqs | RFQ list (filterable) |
| POST | /api/rfqs | Create new RFQ |
| POST | /api/rfqs/:id/issue | Issue RFQ to vendors |
| GET | /api/purchase-orders | All POs |
| GET | /api/contracts | Contract list |
| POST | /api/contracts/monitor | Trigger monitoring cycle |
| GET | /api/vendors | Vendor list |
| POST | /api/vendors/discover | Discover new vendors |
| GET | /api/hitl | Pending HITL queue |
| POST | /api/hitl/:id/resolve | Resolve HITL decision |
| GET | /api/audit | Audit log (paginated) |

---

## Socket.io Events

| Event | Direction | Description |
|---|---|---|
| `agent:event` | Server → Client | Real-time agent action |
| `hitl:new` | Server → Client | New HITL request |
| `hitl:resolved` | Server → Client | HITL decision made |
| `hitl:resolve` | Client → Server | User resolves HITL |

---

## Production Deployment

```bash
# Build React
cd client && npm run build

# Serve static files from Express
# Add to server/index.js:
# app.use(express.static(path.join(__dirname, '../client/dist')))

# MongoDB Atlas
# Set MONGODB_URI=mongodb+srv://... in production env

# PM2
npm install -g pm2
pm2 start server/index.js --name procureiq-api
```
