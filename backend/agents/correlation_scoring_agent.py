from __future__ import annotations

from dataclasses import asdict
from typing import Any

from agents.sensor_fusion_agent import ZoneSignal


WEIGHTS = {
    "gas": 0.30,
    "permit": 0.20,
    "activity": 0.15,
    "equipment": 0.25,
    "workers": 0.10,
}


class CorrelationScoringAgent:
    """Finds dangerous overlaps and computes the 0-100 Safety Score."""

    def score_zone(self, signal: ZoneSignal) -> dict[str, Any]:
        gas_ratio = signal.gas["concentration"] / signal.gas["threshold_limit"]
        gas_risk = min(100, round(gas_ratio * 95))
        permit_risk = 82 if signal.permit["active"] and signal.permit["type"] == "Hot Work" else 18 if signal.permit["active"] else 4
        density = signal.activity["personnel_count"]
        activity_risk = min(100, density * 11 + (20 if signal.activity["activity_type"] in ["Welding", "Maintenance"] else 0))
        equipment_risk = {"Healthy": 8, "Warning": 46, "Overdue": 84, "Fault": 95}[signal.equipment["health_status"]]
        worker_risk = min(100, signal.workers["near_hazard_count"] * 34 + signal.workers["total_workers"] * 5)

        factor_risks = {
            "gas": gas_risk,
            "permit": permit_risk,
            "activity": activity_risk,
            "equipment": equipment_risk,
            "workers": worker_risk,
        }
        weighted_risk = sum(factor_risks[key] * weight for key, weight in WEIGHTS.items())

        combo_bonus = 0
        factors = []
        if gas_risk >= 70:
            factors.append("gas concentration rising near threshold")
        if permit_risk >= 70:
            factors.append("active hot-work permit")
        if equipment_risk >= 70:
            factors.append("overdue or faulty equipment")
        if worker_risk >= 60:
            factors.append("workers close to hazard area")
        if activity_risk >= 55:
            factors.append("high-risk activity and personnel density")
        if len(factors) >= 3:
            combo_bonus = 14
        if len(factors) >= 4:
            combo_bonus = 22

        # A live model should not claim absolute certainty.  Keep a small
        # confidence margin even when every available signal is severe.
        risk_score = min(90, weighted_risk + combo_bonus)
        safety_score = max(0, round(100 - risk_score))
        level = "Critical" if safety_score < 45 else "Watch" if safety_score < 72 else "Safe"

        return {
            **asdict(signal),
            "safety_score": safety_score,
            "risk_level": level,
            "factor_risks": factor_risks,
            "weights": WEIGHTS,
            "compound_factors": factors,
            "compound_bonus": combo_bonus,
        }

    def score(self, signals: list[ZoneSignal]) -> list[dict[str, Any]]:
        return [self.score_zone(signal) for signal in signals]
