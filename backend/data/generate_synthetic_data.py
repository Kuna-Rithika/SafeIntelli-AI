from __future__ import annotations

from datetime import datetime, timedelta
from typing import Any

import numpy as np
import pandas as pd


ZONES = [
    {"zone_id": "A", "zone_name": "Boiler Deck"},
    {"zone_id": "B", "zone_name": "Coke Oven Bay"},
    {"zone_id": "C", "zone_name": "Compressor Hall"},
    {"zone_id": "D", "zone_name": "Storage Yard"},
    {"zone_id": "E", "zone_name": "Control Annex"},
    {"zone_id": "F", "zone_name": "Loading Gantry"},
]


def _status(step: int, zone_id: str, scenario: int = 0) -> dict[str, Any]:
    rng = np.random.default_rng(seed=2026 + step + ord(zone_id))
    base = 22 + rng.normal(0, 2)
    threshold = 100

    dangerous_zone = scenario == 0 and zone_id == "B"
    equipment_scenario = scenario == 1 and zone_id == "A" and step >= 2
    loading_scenario = scenario == 2 and zone_id == "F" and step >= 2
    concentration = base
    permit_active = False
    permit_type = "None"
    activity_type = "Inspection"
    personnel_count = int(rng.integers(1, 4))
    equipment_health = "Healthy"
    near_hazard = 0

    if dangerous_zone:
        concentration = min(112, 28 + step * 12 + rng.normal(0, 2))
        permit_active = step >= 2
        permit_type = "Hot Work" if step >= 2 else "None"
        activity_type = "Welding" if step >= 3 else "Inspection"
        personnel_count = 4 + min(step, 5)
        equipment_health = "Overdue" if step >= 4 else "Warning"
        near_hazard = 1 if step >= 3 else 0
        if step >= 5:
            near_hazard = 3

    if equipment_scenario:
        # A separate scenario: failing equipment and worker exposure create a
        # critical condition without a gas alarm or hot-work permit.
        concentration = 24 + rng.normal(0, 2)
        permit_active = False
        permit_type = "None"
        activity_type = "Maintenance"
        personnel_count = 4 if step == 2 else 7
        equipment_health = "Overdue" if step == 2 else "Fault"
        near_hazard = 0 if step == 2 else 3

    if loading_scenario:
        # A third, distinct incident: gas and worker exposure at the loading
        # gantry. It starts as Watch and becomes Critical in the final stage.
        concentration = 62 + (step - 2) * 5 + rng.normal(0, 2)
        permit_active = False
        permit_type = "None"
        activity_type = "Maintenance"
        personnel_count = 4 if step == 2 else 8
        equipment_health = "Warning"
        near_hazard = 1 if step == 2 else 3

    return {
        "gas": {
            "zone_id": zone_id,
            "gas_type": "CO",
            "concentration": round(float(concentration), 1),
            "threshold_limit": threshold,
        },
        "permit": {
            "permit_id": f"PTW-{zone_id}-{step:03d}" if permit_active else "",
            "type": permit_type,
            "active": permit_active,
            "issued_by": "Safety Desk" if permit_active else "",
        },
        "activity": {
            "zone_id": zone_id,
            "activity_type": activity_type,
            "personnel_count": personnel_count,
        },
        "equipment": {
            "equipment_id": f"EQ-{zone_id}-17",
            "zone_id": zone_id,
            "last_maintenance_date": "2026-05-20",
            "maintenance_due_date": "2026-07-12" if equipment_health in ["Overdue", "Fault"] else "2026-08-15",
            "health_status": equipment_health,
        },
        "workers": {
            "zone_id": zone_id,
            "total_workers": personnel_count,
            "near_hazard_count": near_hazard,
            "proximity_to_hazard_flag": near_hazard > 0,
        },
    }


def build_simulation(total_steps: int = 10, scenario: int = 0) -> list[dict[str, Any]]:
    start = datetime(2026, 7, 19, 10, 0, 0)
    snapshots: list[dict[str, Any]] = []

    for step in range(total_steps):
        timestamp = (start + timedelta(minutes=step * 4)).isoformat()
        gas, permits, activity, equipment, workers = {}, {}, {}, {}, {}
        for zone in ZONES:
            data = _status(step, zone["zone_id"], scenario)
            zone_id = zone["zone_id"]
            gas[zone_id] = {**data["gas"], "timestamp": timestamp}
            permits[zone_id] = {**data["permit"], "start_time": timestamp, "end_time": (start + timedelta(hours=3)).isoformat()}
            activity[zone_id] = {**data["activity"], "time_window": timestamp}
            equipment[zone_id] = data["equipment"]
            workers[zone_id] = {**data["workers"], "timestamp": timestamp}

        snapshots.append(
            {
                "step": step,
                "timestamp": timestamp,
                "zones": ZONES,
                "gas": gas,
                "permits": permits,
                "activity": activity,
                "equipment": equipment,
                "workers": workers,
            }
        )
    return snapshots


def export_csvs(output_dir: str = "generated") -> None:
    snapshots = build_simulation()
    rows = {"gas": [], "permits": [], "activity": [], "equipment": [], "workers": []}
    for snap in snapshots:
        for zone in ZONES:
            zone_id = zone["zone_id"]
            for key in rows:
                source_key = "permits" if key == "permits" else key
                rows[key].append(snap[source_key][zone_id])
    for name, data in rows.items():
        pd.DataFrame(data).to_csv(f"{output_dir}/{name}.csv", index=False)
