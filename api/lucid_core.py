from __future__ import annotations

import json
from datetime import datetime, timedelta
from http.server import BaseHTTPRequestHandler


PRIORITY_WEIGHTS = {"critical": 30, "high": 22, "medium": 14, "low": 8}
MOOD_WEIGHTS = {"steady": -8, "wired": 8, "flat": 12, "locked in": -14}


def parse_deadline(value: str) -> datetime:
    now = datetime.now()
    try:
        hour, minute = [int(part) for part in value.split(":", 1)]
    except Exception:
        hour, minute = 17, 30
    deadline = now.replace(hour=hour, minute=minute, second=0, microsecond=0)
    if deadline < now - timedelta(hours=2):
        deadline += timedelta(days=1)
    return deadline


def minutes_until(value: str) -> int:
    return int((parse_deadline(value) - datetime.now()).total_seconds() // 60)


def energy_curve() -> dict:
    hour = datetime.now().hour
    if 8 <= hour <= 11:
        return {"label": "Peak focus", "score": -12}
    if 13 <= hour <= 15:
        return {"label": "Post-lunch dip", "score": 12}
    if hour >= 20 or hour < 6:
        return {"label": "Low reserve", "score": 16}
    return {"label": "Usable focus", "score": 0}


def pending_tasks(tasks: list[dict]) -> list[dict]:
    enriched = []
    for task in tasks:
        item = dict(task)
        item["minutes_until"] = minutes_until(str(task.get("deadline", "17:30")))
        item["overdue"] = bool(task.get("overdue")) or item["minutes_until"] < 0
        enriched.append(item)
    return [task for task in enriched if task.get("status") != "done"]


def choose_next(tasks: list[dict]) -> dict | None:
    active = pending_tasks(tasks)
    if not active:
        return None
    return sorted(
        active,
        key=lambda task: (
            0 if task.get("overdue") else 1,
            max(task.get("minutes_until", 480), -120),
            -PRIORITY_WEIGHTS.get(task.get("priority"), 10),
            task.get("duration", 1),
        ),
    )[0]


def analyze(payload: dict) -> dict:
    tasks = pending_tasks(payload.get("tasks", []))
    mood = payload.get("mood", "steady")
    energy = energy_curve()
    urgency = sum(PRIORITY_WEIGHTS.get(task.get("priority"), 10) for task in tasks)
    due_soon = sum(14 for task in tasks if 0 <= task.get("minutes_until", 999) <= 120)
    overdue_debt = sum(19 for task in tasks if task.get("overdue"))
    duration_pressure = sum(float(task.get("duration", 1)) * 4 for task in tasks)
    completed_relief = len([task for task in payload.get("tasks", []) if task.get("status") == "done"]) * -11
    raw = urgency * 0.52 + due_soon + overdue_debt + duration_pressure + MOOD_WEIGHTS.get(mood, 0) + energy["score"] + completed_relief
    score = max(6, min(98, round(raw)))
    next_task = choose_next(payload.get("tasks", []))
    impossible = next_task and next_task.get("minutes_until", 999) < float(next_task.get("duration", 1)) * 52

    if score >= 82 or impossible:
        action = "NEGOTIATE"
        reason = f"{next_task.get('name', 'Your top task')} is at risk, so ask for breathing room and protect one focus block."
    elif score >= 65:
        action = "RESHUFFLE"
        reason = f"{next_task.get('name', 'Your queue')} should be handled first, with lower-stakes work moved away."
    elif score >= 45:
        action = "FOCUS"
        reason = f"Start {next_task.get('name', 'one clear task')} now and keep the next action tiny."
    else:
        action = "RECOVER"
        reason = "Your plan has slack. Take a reset before the next useful block."

    return {
        "cognitive_load_score": score,
        "state": "Critical" if score >= 82 else "High Load" if score >= 65 else "Managed" if score >= 45 else "Clear",
        "recommended_action": action,
        "reasoning": reason,
        "next_task_id": next_task.get("id") if next_task else None,
        "next_task_name": next_task.get("name") if next_task else "No pending task",
        "energy": energy,
        "risk_factors": [
            factor
            for factor, active in [
                ("overdue debt", overdue_debt > 0),
                ("deadline inside 2 hours", due_soon > 0),
                ("high duration pressure", duration_pressure > 18),
                ("low mental bandwidth mood", MOOD_WEIGHTS.get(mood, 0) > 5),
            ]
            if active
        ],
    }


def triage(payload: dict) -> dict:
    raw_text = str(payload.get("text", "")).strip()
    text = raw_text.lower()
    analysis = analyze(payload)
    next_name = analysis["next_task_name"]
    greeting_words = {"hi", "hello", "hey", "hii", "yo", "sup"}
    meaningful_words = [word.strip(".,!?;:") for word in text.split() if word.strip(".,!?;:")]
    stress_terms = {
        "stuck", "overwhelmed", "panic", "late", "deadline", "due", "blocked", "behind",
        "miss", "missing", "urgent", "stress", "stressed", "presentation", "bug", "demo",
        "email", "meeting", "exam", "submit", "submission", "finish", "broken"
    }
    is_greeting = len(meaningful_words) <= 2 and all(word in greeting_words for word in meaningful_words)
    has_stress_signal = any(word in stress_terms for word in meaningful_words)

    if not raw_text or is_greeting or (len(meaningful_words) < 4 and not has_stress_signal):
        return {
            "mode": "clarify",
            "ack": "Hi. Tell me what is actually going wrong, and I will help you triage it.",
            "prompt": "Try: what is due, when it is due, and what is blocking you.",
            "examples": [
                "Presentation due in 2 hours and I have not started",
                "Demo bug is blocking submission",
                "Three tasks due today and I do not know what to do first",
            ],
            "analysis": analysis,
        }

    stress_words = [word for word in ["presentation", "bug", "email", "design", "meeting", "deadline", "demo", "tasks", "submission"] if word in text]
    if "presentation" in text or "deck" in text:
        return triage_response("presentation", "presentation deck", "Got it. This is a delivery problem, so we will build the smallest presentable version first.", stress_words or ["presentation", "deadline"], ["Extra slide polish", "Non-essential animations", "Inbox cleanup"], "Create five slide titles only: problem, user, solution, proof, next step.", [("0-8", "Write the five slide titles and one rough bullet under each."), ("8-25", "Fill only the proof/demo slide and the final ask slide."), ("25-40", "Add screenshots or placeholders where visuals are missing."), ("40-50", "Run through the story once out loud and mark gaps."), ("50-60", "Send a status note if it still cannot be finished on time.")], analysis)
    if "bug" in text or "broken" in text or "demo" in text:
        return triage_response("demo_bug", "demo blocker", "This is a demo reliability issue. We will isolate the failure before touching anything else.", stress_words or ["bug", "demo"], ["New features", "Visual tweaks", "Refactors unrelated to the demo path"], "Reproduce the bug once, write the exact failing step, then fix only that path.", [("0-5", "Write the exact click/input sequence that breaks the demo."), ("5-20", "Check the console/server output and identify the failing file or endpoint."), ("20-40", "Patch the smallest possible fix for the demo path only."), ("40-50", "Run the demo flow twice and capture a fallback screenshot."), ("50-60", "If still broken, switch to the fallback story and stop debugging.")], analysis)
    if "too many" in text or "what to do first" in text or "tasks" in text or "prioritize" in text:
        return triage_response("prioritization", "task queue", "This is a prioritization problem. We will reduce the queue before starting work.", stress_words or ["too many tasks", "unclear order"], ["Anything low priority", "Tasks with no judge/user impact", "Cosmetic cleanup"], f"Pick one task: {next_name}. Everything else waits until that has a visible result.", [("0-5", "Label every task as must ship, should ship, or can wait."), ("5-10", f"Start only the must-ship task: {next_name}."), ("10-35", "Produce a visible outcome, even if rough."), ("35-45", "Re-score the queue and move one flexible calendar block."), ("45-60", "Either continue the same task or draft one extension email.")], analysis)
    if "email" in text or "meeting" in text:
        return triage_response("communication", "communication deadline", "This is a communication risk. We will send a clear update before the silence becomes the problem.", stress_words or ["communication deadline"], ["Long explanations", "Perfect wording", "Unnecessary context"], "Write a three-sentence update: status, blocker, proposed next time.", [("0-7", "Draft a short update with the real blocker and a proposed time."), ("7-12", "Remove excuses and keep only facts."), ("12-18", "Send or stage the message for approval."), ("18-35", "Use the cleared time for the highest-risk task.")], analysis)

    return triage_response("general_blocker", next_name, "I have enough context to make a first pass. We will choose one next action and keep it narrow.", stress_words or ["time pressure", "unclear next action"], ["Low-priority admin", "Unscoped polish", "Anything not needed for the next visible result"], f"Open {next_name} and define the smallest visible finish line.", [("0-10", f"Open {next_name} and define the smallest visible finish line."), ("10-30", "Build only the part that proves progress."), ("30-40", "Check whether the deadline is still realistic."), ("40-50", "Move or negotiate one lower-priority commitment if needed.")], analysis)


def triage_response(scenario, target, ack, stressors, drop_today, first_action, plan, analysis):
    return {
        "mode": "triage",
        "scenario": scenario,
        "target": target,
        "ack": ack,
        "detected_stressors": stressors,
        "drop_today": drop_today,
        "delegate_or_delay": ["Move lower-risk work out of this sprint", "Ask for one concrete new checkpoint if timing slips"],
        "next_10_minutes": first_action,
        "plan": [{"minutes": minutes, "action": action} for minutes, action in plan],
        "analysis": analysis,
    }


def optimize_calendar(payload: dict) -> dict:
    events = payload.get("events", [])
    next_task = choose_next(payload.get("tasks", []))
    new_events = []
    moved = []
    inserted = False
    for event in events:
        item = dict(event)
        if not inserted and next_task and not item.get("locked") and item.get("type") == "focus":
            moved.append({"event": item.get("title"), "from": item.get("time"), "to": "15:30", "why": "cleared the earliest flexible focus slot"})
            new_events.append({"id": "urgent-slot", "time": item.get("time", "10:00"), "title": f"Autopilot sprint: {next_task.get('name')}", "type": "focus", "locked": False, "moved": True})
            item["time"] = "15:30"
            item["moved"] = True
            inserted = True
        new_events.append(item)
    if next_task and not inserted:
        new_events.append({"id": "urgent-slot", "time": "16:00", "title": f"Autopilot sprint: {next_task.get('name')}", "type": "focus", "locked": False, "moved": True})
    return {"events": sorted(new_events, key=lambda event: event.get("time", "23:59")), "moves": moved, "summary": f"Protected locked meetings and created a sprint for {next_task.get('name') if next_task else 'your next task'}.", "conflicts_resolved": max(1, len(moved))}


def draft_email(payload: dict) -> dict:
    tasks = pending_tasks(payload.get("tasks", []))
    target = choose_next(payload.get("tasks", [])) or (tasks[0] if tasks else {"name": "the deliverable", "deadline": "today"})
    recipient = payload.get("recipient") or target.get("recipient") or "there"
    new_time = (datetime.now() + timedelta(hours=20)).strftime("%I:%M %p tomorrow").lstrip("0")
    load = analyze(payload)
    reason_map = {
        "quality": "I am protecting quality while reworking the plan around a tight deadline collision",
        "dependency": "I am waiting on one dependency and do not want to send an incomplete handoff",
        "scope": "the scope changed and I am adjusting the final version so it matches what is actually needed",
    }
    why = reason_map.get(payload.get("delay_reason"), reason_map["quality"])
    return {
        "target_task_id": target.get("id"),
        "variants": [
            {"tone": "Clear and calm", "subject": f"Updated timing for {target.get('name')}", "body": f"Hi {recipient},\n\nI wanted to give you a clear update on {target.get('name')}. {why}. I can send a stronger version by {new_time}, and I am happy to share a short progress note today.\n\nBest,"},
            {"tone": "Collaborative", "subject": f"Quick alignment on {target.get('name')}", "body": f"Hi {recipient},\n\nI am close on {target.get('name')}, but the current timing is forcing a rushed handoff. Would {new_time} work for the final version? I can send the current outline first so you are not waiting in the dark.\n\nThank you."},
            {"tone": "Confident", "subject": f"{target.get('name')} - revised delivery window", "body": f"Hi {recipient},\n\nI am moving {target.get('name')} to {new_time} so the final version is useful rather than partial. The revised plan is already in motion, and I will keep the scope tight.\n\nBest,"},
        ],
        "reason": load["reasoning"],
    }


def habit(payload: dict) -> dict:
    tasks = payload.get("tasks", [])
    categories = {}
    for task in tasks:
        categories.setdefault(task.get("category", "general"), 0)
        categories[task.get("category", "general")] += 1
    most_common = max(categories, key=categories.get) if categories else "presentation"
    return {
        "headline": f"{most_common.title()} work needs earlier buffers",
        "summary": f"Your queue suggests {most_common} tasks cluster near deadlines. LucidSprint will reserve a prep block before similar work.",
        "patterns": [
            {"title": "Peak hours", "body": "Use 09:00-11:00 for the highest-risk task, not admin cleanup."},
            {"title": "Delay trap", "body": f"{most_common.title()} tasks should get a forced first draft block."},
            {"title": "Recovery rule", "body": "After one critical task, schedule a 15-minute reset before switching context."},
            {"title": "Negotiation rule", "body": "If load is above 80 and deadline is inside two hours, draft an extension before panic work starts."},
        ],
    }


def read_json(request: BaseHTTPRequestHandler) -> dict:
    length = int(request.headers.get("Content-Length", 0))
    if length <= 0:
        return {}
    try:
        return json.loads(request.rfile.read(length) or b"{}")
    except json.JSONDecodeError:
        return {}


def send_json(request: BaseHTTPRequestHandler, data: dict, status: int = 200) -> None:
    body = json.dumps(data).encode("utf-8")
    request.send_response(status)
    request.send_header("Content-Type", "application/json")
    request.send_header("Cache-Control", "no-store")
    request.send_header("Content-Length", str(len(body)))
    request.end_headers()
    request.wfile.write(body)


class JsonRoute(BaseHTTPRequestHandler):
    route = staticmethod(lambda payload: {"ok": True})

    def do_OPTIONS(self) -> None:
        send_json(self, {"ok": True})

    def do_POST(self) -> None:
        send_json(self, self.route(read_json(self)))
