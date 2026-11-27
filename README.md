# DevSentinel

> **Tagline:** Detect. Investigate. Resolve.  
> **Mission:** AI-Powered Application Monitoring & Incident Intelligence Platform.

DevSentinel is a centralized, modular application observability platform. It collects application logs, HTTP performance metrics, distributed traces, and deployment markers, automatically detects anomalies, correlates forensic evidence, and leverages Google Gemini to hypothesize root causes and provide remediation recommendations.

---

## Architecture Overview

```
devsentinel/
├── frontend/               # React 18 + Vite + TypeScript + Tailwind CSS
├── backend/                # Node.js + Express + TypeScript + Prisma ORM
├── ai-service/             # Python 3.11+ + FastAPI + Gemini API + Scikit-learn
├── sdk/
│   └── node-sdk/           # @devsentinel/node-sdk Express integration
├── infrastructure/
│   ├── docker/             # Docker compose configurations (PostgreSQL + pgvector)
│   └── otel/               # OpenTelemetry instrumentation recipes
└── docs/                   # Architectural & technical design documents
```

---

## Quick Start (Development)

### Prerequisites
- **Node.js**: v18.0.0+ (Tested on v25.0.0)
- **npm**: v9.0.0+ (Tested on v11.6.2)
- **Python**: v3.10+ (Tested on v3.13.1)
- **Docker**: Optional for PostgreSQL + pgvector container

---

### 1. Backend Service
```bash
cd backend
npm install
npm run dev
# Running on http://localhost:5000
# Health check: http://localhost:5000/health
```

### 2. Frontend Application
```bash
cd frontend
npm install
npm run dev
# Running on http://localhost:5173
```

### 3. AI Service (Python FastAPI)
```bash
cd ai-service
python -m venv .venv
# Windows:
.venv\Scripts\activate
# Linux/macOS:
source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
# Running on http://localhost:8000
# Health check: http://localhost:8000/health
```

---

## Hardware Optimization Note
This platform is architected to run within strict resource budgets (optimized for laptops with 8 GB RAM / ~5.83 GB usable). Services can be run individually on-demand rather than running heavy multi-container stacks.
