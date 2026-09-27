import re
from typing import Dict, Any, Optional

def parse_voice_transcript(transcript: str, default_truck_id: Optional[str] = None) -> Dict[str, Any]:
    """
    Parses driver voice audio transcript (e.g. from ElevenLabs)
    into structured operational incident data.
    """
    text = transcript.lower()
    
    # Incident Type
    incident_type = "BREAKDOWN"
    if "accident" in text or "crash" in text or "takkar" in text:
        incident_type = "ACCIDENT"
    elif "puncture" in text or "tyre" in text or "tire" in text:
        incident_type = "TYRE_PUNCTURE"
    elif "traffic" in text or "jam" in text or "delay" in text:
        incident_type = "TRAFFIC_DELAY"
    elif "engine" in text or "kharab" in text or "start nahi" in text or "breakdown" in text:
        incident_type = "ENGINE_BREAKDOWN"

    # Location detection
    location = "Near Hosur, NH 44"
    if "hosur" in text:
        location = "Near Hosur, NH 44 (12.7409 N, 77.8253 E)"
    elif "electronic city" in text or "bangalore" in text or "bengaluru" in text:
        location = "Bengaluru Outskirts, NH 44"
    elif "krishnagiri" in text:
        location = "Near Krishnagiri, NH 44"
    elif "chennai" in text:
        location = "Chennai Highway, Sriperumbudur"

    # Severity
    severity = "HIGH"
    if incident_type in ["ACCIDENT", "ENGINE_BREAKDOWN"]:
        severity = "CRITICAL" if "smoke" in text or "fire" in text or "chot" in text else "HIGH"

    summary = f"Driver reported: {incident_type.replace('_', ' ').title()} near {location}. Vehicle immobilized."

    return {
        "truck_id": default_truck_id or "FG-027",
        "type": incident_type,
        "location": location,
        "severity": severity,
        "transcript": transcript,
        "structured_summary": summary
    }
