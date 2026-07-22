# SafeIntelli AI

Predictive Industrial Safety Intelligence Platform prototype.

## Run Backend

```bash
cd backend
pip install -r requirements.txt
uvicorn main:app --reload
```

The backend can use Groq for AI-powered explanations when `GROQ_API_KEY` is set.

1. Copy `backend/.env.example` to `backend/.env`.
2. Add your Groq API key as `GROQ_API_KEY`.
3. If no key is present, the app falls back to deterministic demo explanations.

The prototype works without an API key by using deterministic demo explanations.

## Run Frontend

```bash
cd frontend
npm install
npm run dev
```

Open the Vite URL shown in the terminal.

## Demo Flow

1. Open the dashboard.
2. Click **Play Scenario** or **Advance**.
3. Watch Zone B move from Watch to Critical as gas, hot work, overdue equipment, and worker proximity overlap.
4. The alarm is generated directly with the Web Audio API, so no audio file is required.
