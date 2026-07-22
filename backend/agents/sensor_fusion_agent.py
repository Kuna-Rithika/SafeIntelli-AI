from __future__ import annotations

from dataclasses import dataclass
from typing import Any


@dataclass
class ZoneSignal:
    zone_id: str
    zone_name: str
    gas: dict[str, Any]
    permit: dict[str, Any]
    activity: dict[str, Any]
    equipment: dict[str, Any]
    workers: dict[str, Any]
    timestamp: str


class SensorFusionAgent:
    """Normalizes raw industrial signals into one zone-level safety snapshot."""

    def fuse(self, snapshot: dict[str, Any]) -> list[ZoneSignal]:
        fused: list[ZoneSignal] = []
        for zone in snapshot["zones"]:
            zone_id = zone["zone_id"]
            fused.append(
                ZoneSignal(
                    zone_id=zone_id,
                    zone_name=zone["zone_name"],
                    gas=snapshot["gas"][zone_id],
                    permit=snapshot["permits"][zone_id],
                    activity=snapshot["activity"][zone_id],
                    equipment=snapshot["equipment"][zone_id],
                    workers=snapshot["workers"][zone_id],
                    timestamp=snapshot["timestamp"],
                )
            )
        return fused
