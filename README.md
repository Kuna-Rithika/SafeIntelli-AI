# SafeIntelli AI

An AI-powered Predictive Industrial Safety Intelligence Platform that detects dangerous combinations of industrial safety risks before they become accidents.

---

## Problem Statement

Industrial facilities rely on multiple independent safety systems such as gas sensors, work permits, equipment monitoring, and worker tracking. Since these systems operate in isolation, dangerous combinations of risks often go unnoticed until an incident occurs.

---

## Solution

SafeIntelli AI combines five industrial safety signals, analyzes them using a multi-agent AI pipeline, computes a live Safety Score for every plant zone, and provides real-time alerts, AI-powered explanations, corrective recommendations, and downloadable incident reports.

---

## Monitored Plant Zones

- Boiler Deck
- Coke Oven Bay
- Compressor Hall
- Storage Yard
- Control Annex
- Loading Gantry

---

## Safety Signals

- Gas Concentration
- Work Permits
- Shift & Activity Logs
- Equipment Health
- Worker Location

---

## Tech Stack

- Frontend: React.js, Recharts
- Backend: FastAPI
- AI Engine: Groq API (Llama 3.3 70B)
- Data Processing: Python, Pandas, NumPy
- Alerts: Web Audio API

---

## How to Run

### Backend

```bash
cd backend
pip install -r requirements.txt
uvicorn main:app --reload
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

Open the Vite URL displayed in the terminal.

---

## Features

- Live Safety Score dashboard for six industrial zones
- Multi-agent AI architecture for safety analysis
- Compound-risk detection across five safety signals
- AI-generated explanations and corrective recommendations
- Real-time buzzer alarm using Web Audio API
- Simulated mobile safety notifications
- Downloadable incident reports
- Three interactive industrial safety demo scenarios

---

## Demo Flow

1. Start the backend and frontend.
2. Open the dashboard.
3. Click **Play Scenario** or **Advance**.
4. Observe how multiple safety risks combine to reduce the Safety Score.
5. Watch the AI generate alerts, explanations, recommendations, and an incident report.