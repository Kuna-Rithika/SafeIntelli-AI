from __future__ import annotations

from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from agents.correlation_scoring_agent import CorrelationScoringAgent
from agents.response_agent import ResponseAgent
from agents.sensor_fusion_agent import SensorFusionAgent
from data.generate_synthetic_data import build_simulation

load_dotenv()


app = FastAPI(title="SafeIntelli AI API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:5174",
        "http://127.0.0.1:5174",
        "http://localhost:4173",
        "http://127.0.0.1:4173",
        "https://safe-intelli-ai.vercel.app",
        "https://safe-intelli-ai-git-main-kuna-rithikas-projects.vercel.app",
    ],
    allow_origin_regex=r"https://.*\.vercel\.app",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],

)

DEMO_ZONES = ["B", "A", "F"]
simulations = [build_simulation(scenario=index) for index in range(len(DEMO_ZONES))]
simulation = simulations[0]
current_step = 0
current_demo = 0
fusion_agent = SensorFusionAgent()
scoring_agent = CorrelationScoringAgent()
response_agent = ResponseAgent()


def _current_zones() -> list[dict]:
    fused = fusion_agent.fuse(simulation[current_step])
    scored = scoring_agent.score(fused)
    return [response_agent.enrich(zone) for zone in scored]


@app.get("/")
def root() -> dict[str, str]:
    return {"name": "SafeIntelli AI", "status": "running"}


@app.get("/zones")
def zones() -> list[dict]:
    return _current_zones()


@app.get("/zones/{zone_id}")
def zone_detail(zone_id: str) -> dict:
    zone_id = zone_id.upper()
    return next(zone for zone in _current_zones() if zone["zone_id"] == zone_id)


@app.get("/zones/{zone_id}/timeline")
def zone_timeline(zone_id: str) -> list[dict]:
    zone_id = zone_id.upper()
    timeline = []
    original_step = globals()["current_step"]
    for index, snapshot in enumerate(simulation):
        fused = fusion_agent.fuse(snapshot)
        scored = scoring_agent.score(fused)
        zone = next(item for item in scored if item["zone_id"] == zone_id)
        timeline.append(
            {
                "step": index,
                "timestamp": snapshot["timestamp"],
                "safety_score": zone["safety_score"],
                "gas": zone["factor_risks"]["gas"],
                "permit": zone["factor_risks"]["permit"],
                "equipment": zone["factor_risks"]["equipment"],
                "workers": zone["factor_risks"]["workers"],
                "activity": zone["factor_risks"]["activity"],
            }
        )
    globals()["current_step"] = original_step
    return timeline


@app.post("/simulate")
def simulate() -> dict:
    global current_step
    current_step = min(current_step + 1, len(simulation) - 1)
    return {"demo": current_demo, "step": current_step, "zones": _current_zones()}


@app.post("/simulate/reset")
def reset() -> dict:
    global current_step
    current_step = 0
    return {"demo": current_demo, "step": current_step, "zones": _current_zones()}


@app.post("/simulate/demo/{demo_id}")
def select_demo(demo_id: int) -> dict:
    global current_demo, current_step, simulation
    if demo_id < 0 or demo_id >= len(simulations):
        return {"error": "Unknown demo"}
    current_demo = demo_id
    current_step = 0
    simulation = simulations[current_demo]
    return {"demo": current_demo, "zone_id": DEMO_ZONES[current_demo], "step": current_step, "zones": _current_zones()}
