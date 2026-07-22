from __future__ import annotations

import os
from datetime import datetime
from typing import Any

import requests


class ResponseAgent:
    """Produces human-readable explanations, recommendations, and reports."""

    def enrich(self, zone: dict[str, Any]) -> dict[str, Any]:
        if zone["risk_level"] != "Critical":
            return {
                **zone,
                "explanation": "No critical compound risk is present. Continue monitoring live sensor, permit, equipment, and worker-location signals.",
                "recommendation": "Maintain current controls and keep permits aligned with gas readings before high-risk work begins.",
                "risk_reduction": 18,
                "incident_report": "",
            }

        generated = self._try_llm(zone) or self._fallback(zone)
        return {**zone, **generated}

    def _try_llm(self, zone: dict[str, Any]) -> dict[str, Any] | None:
        api_key = os.getenv("ANTHROPIC_API_KEY")
        if not api_key:
            return None

        prompt = (
            "You are an industrial safety officer. Explain this compound risk in plain language and "
            "recommend precise corrective actions. Return short JSON with explanation, recommendation, risk_reduction.\n"
            f"Zone data: {zone}"
        )
        try:
            response = requests.post(
                "https://api.anthropic.com/v1/messages",
                headers={
                    "x-api-key": api_key,
                    "anthropic-version": "2023-06-01",
                    "content-type": "application/json",
                },
                json={
                    "model": "claude-3-5-sonnet-latest",
                    "max_tokens": 450,
                    "messages": [{"role": "user", "content": prompt}],
                },
                timeout=8,
            )
            if response.status_code >= 400:
                return None
            text = response.json()["content"][0]["text"]
            return {
                "explanation": text,
                "recommendation": "Review the generated explanation and apply the listed corrective controls immediately.",
                "risk_reduction": 75,
                "incident_report": self._report(zone),
            }
        except Exception:
            return None

    def _fallback(self, zone: dict[str, Any]) -> dict[str, Any]:
        factors = ", ".join(zone["compound_factors"])
        if "active hot-work permit" in zone["compound_factors"]:
            recommendation = (
                f"Pause hot work in {zone['zone_name']}, isolate ignition sources, close Valve V-23, "
                "and evacuate non-essential workers until gas levels normalize."
            )
        else:
            recommendation = (
                f"Stop maintenance in {zone['zone_name']}, isolate the faulty equipment, establish an exclusion zone, "
                "and have a qualified technician verify the asset before workers return."
            )
        return {
            "explanation": (
                f"{zone['zone_name']} is Critical because multiple independent safety signals overlap: {factors}. "
                "This is more dangerous than a single high reading because ignition, fuel source, equipment weakness, "
                "and worker exposure are present in the same time window."
            ),
            "recommendation": recommendation,
            "risk_reduction": 82,
            "incident_report": self._report(zone),
        }

    def _report(self, zone: dict[str, Any]) -> str:
        return (
            f"Preliminary Incident Report\n"
            f"Generated: {datetime.utcnow().isoformat(timespec='seconds')}Z\n"
            f"Zone: {zone['zone_name']} ({zone['zone_id']})\n"
            f"Status: {zone['risk_level']} | Safety Score: {zone['safety_score']}/100\n"
            f"Observed Compound Factors: {', '.join(zone['compound_factors'])}\n"
            f"Immediate Action: Suspend hot work, isolate energy sources, evacuate exposed personnel, "
            f"and verify gas levels before permit reinstatement.\n"
            f"Owner: Shift Safety Officer\n"
        )
