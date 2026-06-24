const priorityWeights = { critical: 30, high: 22, medium: 14, low: 8 };
const makeId = () => (globalThis.crypto?.randomUUID ? crypto.randomUUID() : `task-${Date.now()}-${Math.random().toString(16).slice(2)}`);
const clone = (value) => (typeof structuredClone === "function" ? structuredClone(value) : JSON.parse(JSON.stringify(value)));

const demoTasks = [
  { id: makeId(), name: "Investor presentation", deadline: "11:30", duration: 2, priority: "critical", category: "presentation", status: "pending", overdue: false, recipient: "Maya, accelerator mentor" },
  { id: makeId(), name: "Ship beta bugfix", deadline: "13:00", duration: 1.5, priority: "high", category: "engineering", status: "pending", overdue: false, recipient: "Product team" },
  { id: makeId(), name: "Reply to sponsor brief", deadline: "09:10", duration: 0.5, priority: "medium", category: "email", status: "pending", overdue: true, recipient: "Hackathon sponsor" },
  { id: makeId(), name: "Design voice mode screen", deadline: "16:00", duration: 1, priority: "medium", category: "design", status: "pending", overdue: false, recipient: "Internal" }
];

const calendarSeed = [
  { id: "c1", time: "09:30", title: "Daily standup", type: "external", locked: true },
  { id: "c2", time: "10:00", title: "Focus block: landing polish", type: "focus", locked: false },
  { id: "c3", time: "11:00", title: "Mentor sync", type: "external", locked: true },
  { id: "c4", time: "12:30", title: "Lunch", type: "personal", locked: true },
  { id: "c5", time: "14:00", title: "Inbox cleanup", type: "focus", locked: false }
];

let tasks = clone(demoTasks);
let events = clone(calendarSeed);
let selectedEmail = 0;
let selectedMood = "steady";
let moodScore = -8;
let latestAnalysis = null;
let latestEmails = [];
let latestHabit = null;
let backendOnline = false;
let taskFilter = "all";
let taskSort = "recommended";
let taskQuery = "";
let detectedArchetype = null;
let screenContext = "docs";
let emotionLog = {};
let commitments = [];
let overnightJobs = [
  { type: "research", status: "ready", output: "Prepared a 5-bullet research brief from your highest-risk task." },
  { type: "email", status: "ready", output: "Prepared 3 stakeholder update drafts for the next likely missed deadline." }
];
let proofLog = [
  "Loaded 4 tasks and detected 1 overdue item",
  "Waiting for local backend analysis"
];

const els = {
  serverBadge: document.querySelector("#serverBadge"),
  currentTime: document.querySelector("#currentTime"),
  energyLabel: document.querySelector("#energyLabel"),
  loadScore: document.querySelector("#loadScore"),
  loadState: document.querySelector("#loadState"),
  ringProgress: document.querySelector("#ringProgress"),
  reasoning: document.querySelector("#reasoning"),
  actionPill: document.querySelector("#actionPill"),
  riskList: document.querySelector("#riskList"),
  metricTotal: document.querySelector("#metricTotal"),
  metricOpen: document.querySelector("#metricOpen"),
  metricCritical: document.querySelector("#metricCritical"),
  metricDone: document.querySelector("#metricDone"),
  taskSearch: document.querySelector("#taskSearch"),
  taskSort: document.querySelector("#taskSort"),
  scoreDetails: document.querySelector("#scoreDetails"),
  stepTask: document.querySelector("#stepTask"),
  stepMood: document.querySelector("#stepMood"),
  stepCalendar: document.querySelector("#stepCalendar"),
  stepEmail: document.querySelector("#stepEmail"),
  taskList: document.querySelector("#taskList"),
  taskForm: document.querySelector("#taskForm"),
  taskName: document.querySelector("#taskName"),
  taskPriority: document.querySelector("#taskPriority"),
  taskDuration: document.querySelector("#taskDuration"),
  taskDeadline: document.querySelector("#taskDeadline"),
  transcript: document.querySelector("#transcript"),
  panicText: document.querySelector("#panicText"),
  liveDot: document.querySelector("#liveDot"),
  calendarGrid: document.querySelector("#calendarGrid"),
  calendarSummary: document.querySelector("#calendarSummary"),
  moveLog: document.querySelector("#moveLog"),
  emailList: document.querySelector("#emailList"),
  approvalCopy: document.querySelector("#approvalCopy"),
  recipientInput: document.querySelector("#recipientInput"),
  delayReason: document.querySelector("#delayReason"),
  patternList: document.querySelector("#patternList"),
  habitHeadline: document.querySelector("#habitHeadline"),
  habitSummary: document.querySelector("#habitSummary"),
  proofList: document.querySelector("#proofList"),
  failureRisk: document.querySelector("#failureRisk"),
  failureReason: document.querySelector("#failureReason"),
  archetypeName: document.querySelector("#archetypeName"),
  archetypeCopy: document.querySelector("#archetypeCopy"),
  screenContext: document.querySelector("#screenContext"),
  interventionLadder: document.querySelector("#interventionLadder"),
  commitmentInput: document.querySelector("#commitmentInput"),
  commitmentVisibility: document.querySelector("#commitmentVisibility"),
  stakeCopy: document.querySelector("#stakeCopy"),
  leaderboard: document.querySelector("#leaderboard"),
  premortemTask: document.querySelector("#premortemTask"),
  premortemReason: document.querySelector("#premortemReason"),
  executionTree: document.querySelector("#executionTree"),
  emotionTask: document.querySelector("#emotionTask"),
  emotionButtons: document.querySelector("#emotionButtons"),
  velocityMeter: document.querySelector("#velocityMeter"),
  overnightType: document.querySelector("#overnightType"),
  overnightList: document.querySelector("#overnightList"),
  conflictGraph: document.querySelector("#conflictGraph"),
  toast: document.querySelector("#toast")
};

const onboarding = {
  task: tasks.length > 0,
  mood: false,
  calendar: false,
  email: false
};

function payload(extra = {}) {
  return {
    tasks,
    events,
    mood: selectedMood,
    current_time: new Date().toISOString(),
    recipient: els.recipientInput?.value,
    delay_reason: els.delayReason?.value,
    ...extra
  };
}

async function api(path, body = {}) {
  const response = await fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload(body))
  });
  if (!response.ok) throw new Error(`Backend returned ${response.status}`);
  return response.json();
}

async function checkBackend() {
  try {
    const response = await fetch("/api/health");
    backendOnline = response.ok;
  } catch {
    backendOnline = false;
  }
  if (els.serverBadge) {
    els.serverBadge.textContent = backendOnline ? "Ready" : "Offline mode";
    els.serverBadge.classList.toggle("online", backendOnline);
    els.serverBadge.classList.toggle("offline", !backendOnline);
  }
}

function currentHour() {
  return new Date().getHours();
}

function fallbackEnergy() {
  const hour = currentHour();
  if (hour >= 8 && hour <= 11) return { label: "Peak focus", score: -12 };
  if (hour >= 13 && hour <= 15) return { label: "Post-lunch dip", score: 12 };
  if (hour >= 20 || hour < 6) return { label: "Low reserve", score: 16 };
  return { label: "Usable focus", score: 0 };
}

function fallbackAnalyze() {
  const pending = tasks.filter((task) => task.status !== "done");
  const urgency = pending.reduce((sum, task) => sum + priorityWeights[task.priority], 0);
  const overdueDebt = pending.filter((task) => task.overdue).length * 18;
  const durationPressure = pending.reduce((sum, task) => sum + task.duration * 4, 0);
  const completedRelief = tasks.filter((task) => task.status === "done").length * -11;
  const score = Math.max(8, Math.min(98, Math.round(urgency * 0.52 + overdueDebt + durationPressure + moodScore + fallbackEnergy().score + completedRelief)));
  const nextTask = chooseLocalNext();
  return {
    cognitive_load_score: score,
    state: score >= 82 ? "Critical" : score >= 65 ? "High Load" : score >= 45 ? "Managed" : "Clear",
    recommended_action: score >= 82 ? "NEGOTIATE" : score >= 65 ? "RESHUFFLE" : score >= 45 ? "FOCUS" : "RECOVER",
    reasoning: nextTask ? `${nextTask.name} is the best next move. Start small, then rescore.` : "No pending work left.",
    next_task_id: nextTask?.id,
    next_task_name: nextTask?.name || "No pending task",
    energy: fallbackEnergy(),
    risk_factors: pending.filter((task) => task.overdue).length ? ["overdue debt"] : []
  };
}

function chooseLocalNext() {
  const pending = tasks.filter((task) => task.status !== "done");
  return [...pending].sort((a, b) => {
    if (a.overdue !== b.overdue) return a.overdue ? -1 : 1;
    return priorityWeights[b.priority] - priorityWeights[a.priority];
  })[0];
}

async function refreshAnalysis() {
  const now = new Date();
  els.currentTime.textContent = now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

  if (backendOnline) {
    try {
      latestAnalysis = await api("/api/analyze");
    } catch {
      backendOnline = false;
      latestAnalysis = fallbackAnalyze();
      proof("Backend unavailable, switched to browser-side fallback");
    }
  } else {
    latestAnalysis = fallbackAnalyze();
  }

  renderAnalysis();
  renderTasks();
  renderCalendar();
  renderHabit();
  renderLab();
}

function renderAnalysis() {
  const score = latestAnalysis?.cognitive_load_score ?? 0;
  els.energyLabel.textContent = latestAnalysis?.energy?.label || fallbackEnergy().label;
  els.loadScore.textContent = score;
  els.loadState.textContent = latestAnalysis?.state || "Unknown";
  els.actionPill.textContent = latestAnalysis?.recommended_action || "ANALYZE";
  els.reasoning.textContent = latestAnalysis?.reasoning || "Add a task to get a recommendation.";
  const risks = latestAnalysis?.risk_factors?.length ? latestAnalysis.risk_factors : ["no major blockers"];
  els.riskList.innerHTML = risks.map((risk) => `<span>${escapeHtml(risk)}</span>`).join("");
  els.scoreDetails.textContent = `Score ${score}: ${tasks.filter((task) => task.status !== "done").length} open task(s), ${tasks.filter((task) => task.priority === "critical" && task.status !== "done").length} critical item(s), mood set to ${selectedMood}, and current energy is ${latestAnalysis?.energy?.label || fallbackEnergy().label}.`;
  els.ringProgress.style.strokeDashoffset = String(427 - (427 * score) / 100);
  els.ringProgress.style.stroke = score >= 82 ? "var(--danger)" : score >= 65 ? "var(--warning)" : score >= 45 ? "var(--primary)" : "var(--success)";
  renderOnboarding();
}

function renderTasks() {
  renderMetrics();
  const visibleTasks = filteredTasks();
  els.taskList.innerHTML = visibleTasks.length ? visibleTasks.map((task) => `
    <article class="task ${task.status === "done" ? "done" : ""}">
      <button data-complete="${task.id}" title="Mark complete" aria-label="Mark ${escapeHtml(task.name)} complete">✓</button>
      <div>
        <strong>${escapeHtml(task.name)}</strong><br />
        <small>${task.duration}h · due ${task.deadline}${task.overdue ? " · overdue debt" : ""}</small>
        <footer>
          <span class="micro-tag">${escapeHtml(task.category || "general")}</span>
          <span class="micro-tag">${task.status.replace("_", " ")}</span>
          ${latestAnalysis?.next_task_id === task.id ? '<span class="micro-tag">next best action</span>' : ""}
        </footer>
      </div>
      <span class="priority ${task.priority}">${task.priority}</span>
      <button class="task-edit" data-edit="${task.id}" title="Edit task" aria-label="Edit ${escapeHtml(task.name)}">✎</button>
      <button class="task-delete" data-delete="${task.id}" title="Delete task" aria-label="Delete ${escapeHtml(task.name)}">×</button>
    </article>
  `).join("") : `<article class="proof"><strong>No tasks match the current filters.</strong></article>`;

  document.querySelectorAll("[data-complete]").forEach((button) => {
    button.addEventListener("click", async () => {
      const task = tasks.find((item) => item.id === button.dataset.complete);
      task.status = task.status === "done" ? "pending" : "done";
      task.overdue = false;
      proof(`Updated "${task.name}" and rescored the plan`);
      showToast(`Updated ${task.name}`);
      await refreshAnalysis();
    });
  });

  document.querySelectorAll("[data-delete]").forEach((button) => {
    button.addEventListener("click", async () => {
      const task = tasks.find((item) => item.id === button.dataset.delete);
      tasks = tasks.filter((item) => item.id !== button.dataset.delete);
      proof(`Removed "${task?.name || "task"}" from the queue`);
      showToast("Task removed.");
      await refreshAnalysis();
    });
  });

  document.querySelectorAll("[data-edit]").forEach((button) => {
    button.addEventListener("click", () => {
      const task = tasks.find((item) => item.id === button.dataset.edit);
      if (!task) return;
      els.taskName.value = task.name;
      els.taskPriority.value = task.priority;
      els.taskDuration.value = task.duration;
      els.taskDeadline.value = task.deadline;
      tasks = tasks.filter((item) => item.id !== task.id);
      els.taskName.focus();
      proof(`Loaded "${task.name}" into the form for editing`);
      showToast("Edit the fields, then press Add task.");
      renderTasks();
    });
  });
}

function renderMetrics() {
  els.metricTotal.textContent = tasks.length;
  els.metricOpen.textContent = tasks.filter((task) => task.status !== "done").length;
  els.metricCritical.textContent = tasks.filter((task) => task.priority === "critical" && task.status !== "done").length;
  els.metricDone.textContent = tasks.filter((task) => task.status === "done").length;
}

function filteredTasks() {
  const query = taskQuery.trim().toLowerCase();
  return [...tasks]
    .filter((task) => taskFilter === "all" || task.status === taskFilter)
    .filter((task) => !query || [task.name, task.status, task.priority, task.category].some((value) => String(value || "").toLowerCase().includes(query)))
    .sort((a, b) => {
      if (taskSort === "deadline") return a.deadline.localeCompare(b.deadline);
      if (taskSort === "priority") return priorityWeights[b.priority] - priorityWeights[a.priority];
      if (taskSort === "duration") return Number(b.duration) - Number(a.duration);
      if (latestAnalysis?.next_task_id === a.id) return -1;
      if (latestAnalysis?.next_task_id === b.id) return 1;
      if (a.overdue !== b.overdue) return a.overdue ? -1 : 1;
      return priorityWeights[b.priority] - priorityWeights[a.priority];
    });
}

function renderCalendar() {
  els.calendarGrid.innerHTML = events.map((event) => `
    <article class="event ${event.type} ${event.moved ? "moved" : ""}">
      <strong>${event.time}</strong>
      <div>
        <strong>${escapeHtml(event.title)}</strong><br />
        <small>${event.locked ? "Protected external/personal event" : "Movable focus block"}</small>
      </div>
      <span>${event.moved ? "moved" : event.locked ? "locked" : "flex"}</span>
      <button data-move-event="${event.id}" ${event.locked ? "disabled" : ""}>Move</button>
    </article>
  `).join("");

  els.moveLog.innerHTML = proofLog.slice(-6).map((item) => `<article class="proof"><strong>${escapeHtml(item)}</strong></article>`).join("");

  document.querySelectorAll("[data-move-event]").forEach((button) => {
    button.addEventListener("click", () => {
      const event = events.find((item) => item.id === button.dataset.moveEvent);
      if (!event || event.locked) return;
      event.time = event.time < "14:00" ? "15:30" : "10:30";
      event.moved = true;
      proof(`Manually moved "${event.title}" to ${event.time}`);
      showToast("Calendar event moved.");
      renderCalendar();
    });
  });
}

function fallbackEmails() {
  const target = chooseLocalNext() || tasks[0];
  return [
    { tone: "Clear and calm", subject: `Updated timing for ${target.name}`, body: `Hi ${els.recipientInput.value},\n\nI am adjusting the timeline for ${target.name} so I can send something useful rather than rushed. I can share the final version tomorrow morning and a short progress note today.\n\nBest,` },
    { tone: "Collaborative", subject: `Quick alignment on ${target.name}`, body: `Hi ${els.recipientInput.value},\n\nThe deadline is tight on ${target.name}. Would tomorrow morning work for the final version? I can send a rough preview today so you have visibility.\n\nThank you.` },
    { tone: "Confident", subject: `${target.name} - revised delivery window`, body: `Hi ${els.recipientInput.value},\n\nI am moving ${target.name} to tomorrow morning to protect quality. The revised plan is already in motion and I will keep the scope tight.\n\nBest,` }
  ];
}

function renderEmails() {
  const variants = latestEmails.length ? latestEmails : fallbackEmails();
  els.emailList.innerHTML = variants.map((mail, index) => `
    <article class="email-card ${index === selectedEmail ? "selected" : ""}" data-email="${index}">
      <small>${escapeHtml(mail.tone)}</small>
      <h2>${escapeHtml(mail.subject)}</h2>
      <p>${escapeHtml(mail.body)}</p>
    </article>
  `).join("");

  document.querySelectorAll("[data-email]").forEach((card) => {
    card.addEventListener("click", () => {
      selectedEmail = Number(card.dataset.email);
      renderEmails();
    });
  });
}

function renderHabit() {
  els.habitHeadline.textContent = latestHabit?.headline || "Scheduling rules adapt to your queue";
  els.habitSummary.textContent = latestHabit?.summary || "Autopilot converts repeated delay patterns into earlier buffers, negotiation triggers, and recovery windows.";
  const patterns = latestHabit?.patterns || [
    { title: "Peak hours", body: "Use 09:00-11:00 for the riskiest work." },
    { title: "Delay trap", body: "Presentation and design tasks need earlier first-draft blocks." },
    { title: "Recovery rule", body: "After a critical task, add a 15-minute reset before switching context." },
    { title: "Negotiation rule", body: "Draft extension emails before panic work eats the whole plan." }
  ];
  els.patternList.innerHTML = patterns.map((item) => `
    <article class="pattern">
      <strong>${escapeHtml(item.title)}</strong>
      <p>${escapeHtml(item.body)}</p>
    </article>
  `).join("");
  els.proofList.innerHTML = proofLog.map((item, index) => `
    <article class="proof">
      <small>Step ${index + 1}</small>
      <strong>${escapeHtml(item)}</strong>
    </article>
  `).join("");
}

function analyzeArchetype() {
  const pending = tasks.filter((task) => task.status !== "done");
  const done = tasks.filter((task) => task.status === "done");
  const easyDone = done.filter((task) => task.duration <= 0.5 || task.priority === "low").length;
  const hardPending = pending.filter((task) => task.priority === "critical" || task.duration >= 1.5).length;
  const avoider = pending.find((task) => /email|call|reply|follow|stakeholder/i.test(task.name));
  const noEstimate = pending.find((task) => !Number(task.duration));
  const lastMinute = pending.filter((task) => task.deadline <= "12:00" || task.overdue).length;
  const notStarted = pending.filter((task) => task.status === "pending").length;

  if (avoider) {
    return { name: "Avoider", score: 86, reason: `"${avoider.name}" looks like communication work being avoided.`, intervention: "Surface the uncomfortable part, then write the first two sentences only." };
  }
  if (easyDone >= 2 && hardPending > 0) {
    return { name: "Busy Fool", score: 82, reason: "Easy work is moving while hard work is still untouched.", intervention: "Block easy tasks until one hard task gets a 15-minute start." };
  }
  if (lastMinute >= 2) {
    return { name: "Thrill-Seeker", score: 88, reason: "Multiple urgent items are close enough to create last-minute adrenaline work.", intervention: "Manufacture an earlier private deadline and move a flexible calendar block now." };
  }
  if (pending.length >= 5 || notStarted >= 4) {
    return { name: "Overwhelmed", score: 84, reason: "There are several open tasks and most have not started.", intervention: "Break the next task into 15-minute micro-steps and hide everything else." };
  }
  if (noEstimate) {
    return { name: "Dreamer", score: 69, reason: "A task exists without a reliable time estimate.", intervention: "Force a time estimate before saving or scheduling new work." };
  }
  return { name: "Perfectionist", score: 72, reason: "The queue is controlled, so the risk is over-polishing the visible work.", intervention: "Start a good-enough timer and lock the task after one visible pass." };
}

function renderLab() {
  if (!els.failureRisk) return;
  const profile = detectedArchetype || analyzeArchetype();
  const score = Math.max(profile.score, latestAnalysis?.cognitive_load_score || 0);
  els.failureRisk.textContent = `${Math.min(98, score)}%`;
  els.failureReason.textContent = profile.reason;
  els.archetypeName.textContent = detectedArchetype ? detectedArchetype.name : "Ready to scan";
  els.archetypeCopy.textContent = detectedArchetype ? `${detectedArchetype.reason} Intervention: ${detectedArchetype.intervention}` : "Run Detect to classify perfectionist, overwhelmed, thrill-seeker, dreamer, avoider, or busy fool patterns from the current queue.";
  renderScreenContext();
  renderCommitments();
  renderEmotionControls();
  renderOvernight();
  renderConflictGraph();
}

function renderScreenContext() {
  if (!els.interventionLadder) return;
  const ladders = {
    docs: ["Log as productive focus and lower urgency slightly.", "Nudge only if the active task is not the highest-risk item.", "Offer a 5-minute finish line when focus exceeds 45 minutes.", "Protect the tab from calendar interruptions."],
    youtube: ["Gentle nudge: this looks off-task during a deadline window.", "Overlay reset: off-task 18 minutes, choose resume or intentional break.", "Voice check-in: what are you avoiding?", "Dramatic mode: blur non-work tabs until one micro-step is done."],
    email: ["Detect reply obligations and attach them to task debt.", "Surface only messages related to current deadlines.", "Draft the next stakeholder update.", "Pause inbox browsing after the required reply is staged."],
    calendar: ["Run Calendar Tetris against flexible events.", "Highlight impossible collisions.", "Move lower-priority blocks.", "Confirm the protected focus plan out loud."],
    locked: ["Log a break instead of treating silence as failure.", "Rescore energy after return.", "Suggest a restart step under 5 minutes.", "Protect recovery if load score is critical."]
  };
  const items = ladders[screenContext] || ladders.docs;
  els.interventionLadder.innerHTML = items.map((item) => `<li>${escapeHtml(item)}</li>`).join("");
}

function renderCommitments() {
  if (!els.leaderboard) return;
  els.leaderboard.innerHTML = commitments.length ? commitments.map((item) => `
    <article class="commitment-card ${item.status}">
      <div>
        <strong>${escapeHtml(item.title)}</strong>
        <small>${escapeHtml(item.visibility)} · ${escapeHtml(item.stake)}</small>
      </div>
      <button data-commit-done="${item.id}">Done</button>
      <button data-commit-miss="${item.id}">Missed</button>
    </article>
  `).join("") : `<article class="proof"><strong>No public commitments yet.</strong></article>`;

  document.querySelectorAll("[data-commit-done]").forEach((button) => {
    button.addEventListener("click", () => {
      const item = commitments.find((entry) => entry.id === button.dataset.commitDone);
      if (!item) return;
      item.status = "done";
      proof(`Accountability commitment completed: ${item.title}`);
      showToast("Commitment marked done.");
      renderCommitments();
      renderHabit();
    });
  });
  document.querySelectorAll("[data-commit-miss]").forEach((button) => {
    button.addEventListener("click", () => {
      const item = commitments.find((entry) => entry.id === button.dataset.commitMiss);
      if (!item) return;
      item.status = "missed";
      proof(`Miss report created for commitment: ${item.title}`);
      showToast("Miss report staged.");
      renderCommitments();
      renderHabit();
    });
  });
}

function renderEmotionControls() {
  if (!els.emotionTask) return;
  const selected = els.emotionTask.value;
  els.emotionTask.innerHTML = tasks.map((task) => `<option value="${task.id}">${escapeHtml(task.name)}</option>`).join("");
  if (selected && tasks.some((task) => task.id === selected)) els.emotionTask.value = selected;
  renderVelocity();
}

function renderVelocity() {
  if (!els.velocityMeter) return;
  const id = els.emotionTask.value || tasks[0]?.id;
  const entries = emotionLog[id] || [];
  const last = entries.at(-1);
  const previous = entries.at(-2);
  const scores = { excited: 1, neutral: 0, meh: -1, anxious: -2, dreading: -3 };
  const delta = last && previous ? scores[last.emotion] - scores[previous.emotion] : 0;
  const task = tasks.find((item) => item.id === id);
  const prediction = !last ? "Tap how this task feels to start emotional velocity tracking." : delta < 0 ? "Declining emotion detected. Trigger a prevention block before this turns into avoidance." : last.emotion === "dreading" || last.emotion === "anxious" ? "High emotional friction. Reduce scope to one visible micro-step." : "Emotional signal is stable enough for focused work.";
  els.velocityMeter.innerHTML = `
    <article class="velocity-item">
      <strong>${escapeHtml(task?.name || "No task selected")}</strong>
      <p>${escapeHtml(prediction)}</p>
      <small>${entries.length ? entries.map((entry) => entry.emotion).join(" -> ") : "No readings yet"}</small>
    </article>
  `;
}

function renderOvernight() {
  if (!els.overnightList) return;
  els.overnightList.innerHTML = overnightJobs.length ? overnightJobs.map((job, index) => `
    <article class="overnight-card">
      <strong>${escapeHtml(job.type)} · ${escapeHtml(job.status)}</strong>
      <p>${escapeHtml(job.output || "Queued for the next offline window.")}</p>
      ${job.status === "queued" ? `<button class="quiet-button" data-run-job="${index}">Run now</button>` : ""}
    </article>
  `).join("") : `<article class="proof"><strong>No overnight jobs queued.</strong></article>`;

  document.querySelectorAll("[data-run-job]").forEach((button) => {
    button.addEventListener("click", () => {
      completeOvernightJob(Number(button.dataset.runJob));
      renderOvernight();
    });
  });
}

function conflictItems() {
  const pending = tasks.filter((task) => task.status !== "done");
  const blocker = pending.find((task) => task.overdue || task.priority === "critical") || pending[0];
  const communication = pending.filter((task) => /email|reply|call|stakeholder/i.test(task.name));
  const denseWindow = pending.filter((task) => task.deadline <= "13:00");
  return [
    { kind: "root", title: blocker?.name || "No root blocker", body: blocker ? "Root blocker because it has the highest deadline pressure." : "Add tasks to build dependency graph." },
    { kind: "blocker", title: `${denseWindow.length} morning collision(s)`, body: denseWindow.length ? "Temporal conflict: too much work lands before early afternoon." : "No early deadline collision detected." },
    { kind: "energy", title: `${communication.length} communication risk(s)`, body: communication.length ? "Avoidance pattern: email/call tasks often get delayed under load." : "No communication avoidance detected." },
    { kind: "root", title: "Calendar dependency", body: events.some((event) => !event.locked) ? "Flexible blocks can move to unblock the root task." : "No flexible blocks available." },
    { kind: "energy", title: `Energy curve: ${fallbackEnergy().label}`, body: "Scheduling should match task difficulty to current energy." },
    { kind: "blocker", title: "Scope conflict", body: pending.length > 4 ? "Too many parallel tasks. Hide can-wait work until one visible result ships." : "Scope is manageable." }
  ];
}

function renderConflictGraph() {
  if (!els.conflictGraph) return;
  els.conflictGraph.innerHTML = conflictItems().map((item) => `
    <article class="graph-node ${item.kind}">
      <strong>${escapeHtml(item.title)}</strong>
      <p>${escapeHtml(item.body)}</p>
    </article>
  `).join("");
}

function generatePremortem() {
  const target = els.premortemTask.value.trim() || chooseLocalNext()?.name || "Highest-risk task";
  const reason = els.premortemReason.value.trim() || "I start too late, miss a dependency, or polish the wrong part.";
  const nodes = [
    { title: "Failure imagined", body: `${target} misses because: ${reason}` },
    { title: "Prevention block", body: `Schedule 25 minutes now for the smallest visible version of ${target}.` },
    { title: "Dependency check", body: "List one person, file, API, or asset that could block completion." },
    { title: "Proof capture", body: "Create a screenshot, draft, or commit that proves progress before the next rescore." }
  ];
  els.executionTree.innerHTML = nodes.map((node) => `
    <article class="tree-node">
      <strong>${escapeHtml(node.title)}</strong>
      <p>${escapeHtml(node.body)}</p>
    </article>
  `).join("");
  events.push({ id: makeId(), time: "10:45", title: `Pre-mortem prevention: ${target}`, type: "focus", locked: false, moved: true });
  events = events.sort((a, b) => a.time.localeCompare(b.time));
  proof(`Pre-mortem created prevention tree for "${target}"`);
  renderCalendar();
  renderHabit();
  showToast("Pre-mortem tree generated and scheduled.");
}

function completeOvernightJob(index) {
  const job = overnightJobs[index];
  if (!job) return;
  const nextTask = chooseLocalNext()?.name || "the highest-risk task";
  const outputs = {
    research: `Research brief for ${nextTask}: user pain, competitor gap, demo proof, pitch line, and judge question prep.`,
    email: `Three drafts prepared: apologetic, confident, and collaborative for ${nextTask}.`,
    agenda: `Meeting agenda prepared: context, decision needed, blockers, owner, next checkpoint.`,
    doc: `Document summary prepared: key claims, missing proof, risky assumptions, and final edits.`,
    weekly: `Weekly report prepared: shipped, blocked, learned, next bets, and asks.`
  };
  job.status = "ready";
  job.output = outputs[job.type] || `Prepared useful context for ${nextTask}.`;
  proof(`Overnight Autopilot prepared ${job.type} output`);
  showToast("Overnight job prepared.");
}

function renderOnboarding() {
  onboarding.task = tasks.length > 0;
  const map = [
    ["stepTask", onboarding.task],
    ["stepMood", onboarding.mood],
    ["stepCalendar", onboarding.calendar],
    ["stepEmail", onboarding.email]
  ];
  map.forEach(([key, done]) => {
    const el = els[key];
    if (!el) return;
    el.textContent = done ? "●" : "○";
    el.closest(".setup-step")?.classList.toggle("done", done);
  });
}

async function runTetris() {
  if (backendOnline) {
    try {
      const result = await api("/api/calendar-tetris");
      events = result.events;
      els.calendarSummary.textContent = `${result.summary} Conflicts resolved: ${result.conflicts_resolved}.`;
      result.moves.forEach((move) => proof(`Moved "${move.event}" from ${move.from} to ${move.to}: ${move.why}`));
    } catch {
      fallbackTetris();
    }
  } else {
    fallbackTetris();
  }
  proof(`Calendar optimized around ${latestAnalysis?.next_task_name || "the next task"}`);
  onboarding.calendar = true;
  showToast("Calendar optimized from current queue.");
  renderCalendar();
  renderOnboarding();
}

function fallbackTetris() {
  const nextTask = chooseLocalNext();
  events = events.map((event) => event.id === "c2" ? { ...event, time: "15:30", moved: true } : event);
  events.push({ id: "urgent-slot", time: "10:00", title: `Autopilot sprint: ${nextTask?.name || "priority task"}`, type: "focus", locked: false, moved: true });
  events = events.sort((a, b) => a.time.localeCompare(b.time));
  els.calendarSummary.textContent = "Fallback optimizer moved the first flexible focus block and inserted an urgent sprint.";
}

async function enterPanicMode(text = "I have a presentation due in 2 hours and I have not started.") {
  els.liveDot.classList.add("active");
  appendLine("You", text);
  let result;

  if (backendOnline) {
    try {
      result = await api("/api/triage", { text });
    } catch {
      result = fallbackTriage(text);
    }
  } else {
    result = fallbackTriage(text);
  }

  appendLine("Coach", result.ack);
  if (result.mode === "clarify") {
    appendLine("Coach", result.prompt);
    appendList("Examples", result.examples);
    proof("Asked for more context instead of running triage on a greeting");
    els.liveDot.classList.remove("active");
    showToast("Tell Autopilot what is due and what is blocking you.");
    return;
  }
  appendList("Detected", result.detected_stressors);
  appendLine("Coach", `Drop today: ${result.drop_today.join(", ")}.`);
  appendLine("Coach", `Next 10 minutes: ${result.next_10_minutes}`);
  result.plan.forEach((step) => appendLine(step.minutes, step.action));
  proof(`Panic Mode built a ${result.plan.length}-step plan from the user's words`);
  latestAnalysis = result.analysis || latestAnalysis;
  await runTetris();
  els.liveDot.classList.remove("active");
  showToast("Panic triage generated from your input.");
  renderAnalysis();
}

function fallbackTriage(text) {
  const nextTask = chooseLocalNext();
  const words = text.toLowerCase().split(/\s+/).filter(Boolean);
  const greetings = ["hi", "hello", "hey", "hii"];
  const stressSignals = ["deadline", "due", "panic", "overwhelmed", "stuck", "blocked", "late", "bug", "demo", "presentation"];
  if (words.length <= 2 && words.every((word) => greetings.includes(word))) {
    return {
      mode: "clarify",
      ack: "Hi. Tell me what is actually going wrong, and I will help you triage it.",
      prompt: "Try: what is due, when it is due, and what is blocking you.",
      examples: [
        "Presentation due in 2 hours and I have not started",
        "Demo bug is blocking submission",
        "Three tasks due today and I do not know what to do first"
      ],
      analysis: fallbackAnalyze()
    };
  }
  if (words.length < 4 && !words.some((word) => stressSignals.includes(word))) {
    return {
      mode: "clarify",
      ack: "I need one more detail before I make a plan.",
      prompt: "What is due, when is it due, and what is blocking you?",
      examples: ["Report due tonight and data is missing", "Email deadline in 1 hour", "App bug before demo"],
      analysis: fallbackAnalyze()
    };
  }
  const lower = text.toLowerCase();
  if (lower.includes("presentation") || lower.includes("deck")) {
    return {
      mode: "triage",
      scenario: "presentation",
      ack: "Got it. This is a delivery problem, so we will build the smallest presentable version first.",
      detected_stressors: ["presentation", "deadline"],
      drop_today: ["Extra slide polish", "Non-essential animations", "Inbox cleanup"],
      next_10_minutes: "Create five slide titles only: problem, user, solution, proof, next step.",
      plan: [
        { minutes: "0-8", action: "Write the five slide titles and one rough bullet under each." },
        { minutes: "8-25", action: "Fill only the proof/demo slide and the final ask slide." },
        { minutes: "25-40", action: "Add screenshots or placeholders where visuals are missing." },
        { minutes: "40-50", action: "Run through the story once out loud and mark gaps." }
      ],
      analysis: fallbackAnalyze()
    };
  }
  if (lower.includes("bug") || lower.includes("demo") || lower.includes("broken")) {
    return {
      mode: "triage",
      scenario: "demo_bug",
      ack: "This is a demo reliability issue. We will isolate the failure before touching anything else.",
      detected_stressors: ["bug", "demo"],
      drop_today: ["New features", "Visual tweaks", "Unrelated refactors"],
      next_10_minutes: "Reproduce the bug once, write the exact failing step, then fix only that path.",
      plan: [
        { minutes: "0-5", action: "Write the exact click/input sequence that breaks the demo." },
        { minutes: "5-20", action: "Check console/server output and identify the failing file or endpoint." },
        { minutes: "20-40", action: "Patch the smallest possible fix for the demo path only." },
        { minutes: "40-50", action: "Run the demo flow twice and capture a fallback screenshot." }
      ],
      analysis: fallbackAnalyze()
    };
  }
  if (lower.includes("too many") || lower.includes("what to do first") || lower.includes("tasks")) {
    return {
      mode: "triage",
      scenario: "prioritization",
      ack: "This is a prioritization problem. We will reduce the queue before starting work.",
      detected_stressors: ["too many tasks", "unclear order"],
      drop_today: ["Low-priority admin", "Tasks with no demo/user impact", "Cosmetic cleanup"],
      next_10_minutes: `Pick one task: ${nextTask?.name || "the highest-risk item"}. Everything else waits.`,
      plan: [
        { minutes: "0-5", action: "Label every task as must ship, should ship, or can wait." },
        { minutes: "5-10", action: `Start only: ${nextTask?.name || "the must-ship task"}.` },
        { minutes: "10-35", action: "Produce a visible outcome, even if rough." },
        { minutes: "35-45", action: "Re-score the queue and move one flexible calendar block." }
      ],
      analysis: fallbackAnalyze()
    };
  }
  return {
    mode: "triage",
    ack: "This is a load spike, not a character flaw. I am turning it into a sequence.",
    detected_stressors: text.split(/\s+/).filter((word) => word.length > 6).slice(0, 3),
    drop_today: ["Inbox cleanup", "Nice-to-have polish"],
    next_10_minutes: `Open ${nextTask?.name || "the top task"} and make the roughest usable first pass.`,
    plan: [
      { minutes: "0-10", action: "Create the smallest visible version." },
      { minutes: "10-35", action: "Complete the judge-visible part only." },
      { minutes: "35-45", action: "Draft a deadline note if still blocked." }
    ],
    analysis: fallbackAnalyze()
  };
}

function appendLine(speaker, text) {
  const line = document.createElement("p");
  line.innerHTML = `<strong>${escapeHtml(speaker)}</strong> ${escapeHtml(text)}`;
  els.transcript.appendChild(line);
  els.transcript.scrollTop = els.transcript.scrollHeight;
}

function appendList(label, items) {
  const line = document.createElement("p");
  line.innerHTML = `<strong>${escapeHtml(label)}</strong><ul>${items.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>`;
  els.transcript.appendChild(line);
  els.transcript.scrollTop = els.transcript.scrollHeight;
}

function proof(message) {
  proofLog.push(message);
  if (proofLog.length > 10) proofLog = proofLog.slice(-10);
}

function showToast(message) {
  els.toast.textContent = message;
  els.toast.classList.add("show");
  window.clearTimeout(showToast.timer);
  showToast.timer = window.setTimeout(() => els.toast.classList.remove("show"), 2400);
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" })[char]);
}

async function switchView(view) {
  document.querySelectorAll(".rail-button").forEach((item) => item.classList.toggle("active", item.dataset.view === view));
  document.querySelectorAll(".workflow-card").forEach((item) => item.classList.toggle("active", item.dataset.jump === view && view !== "home"));
  document.querySelectorAll(".view").forEach((item) => item.classList.remove("active"));
  document.querySelector(`#${view}View`).classList.add("active");
  if (view === "habit" && backendOnline) {
    latestHabit = await api("/api/habit-dna").catch(() => latestHabit);
    renderHabit();
  }
}

document.querySelectorAll(".rail-button").forEach((button) => {
  button.addEventListener("click", async () => {
    await switchView(button.dataset.view);
  });
});

document.querySelectorAll("[data-jump]").forEach((button) => {
  button.addEventListener("click", async () => {
    await switchView(button.dataset.jump);
    const focusId = button.dataset.focus;
    if (focusId) document.querySelector(`#${focusId}`)?.focus();
    if (button.dataset.action === "start") document.querySelector("#doNext").click();
    if (button.dataset.action === "calendar") runTetris();
    if (button.dataset.action === "email") document.querySelector("#draftEmails").click();
  });
});

document.querySelectorAll(".mood").forEach((button) => {
  button.addEventListener("click", async () => {
    document.querySelectorAll(".mood").forEach((item) => item.classList.remove("active"));
    button.classList.add("active");
    selectedMood = button.dataset.mood;
    moodScore = Number(button.dataset.score);
    onboarding.mood = true;
    proof(`Mood signal changed to ${selectedMood}`);
    await refreshAnalysis();
  });
});

els.taskSearch.addEventListener("input", () => {
  taskQuery = els.taskSearch.value;
  renderTasks();
});

els.taskSort.addEventListener("change", () => {
  taskSort = els.taskSort.value;
  renderTasks();
});

document.querySelectorAll("#taskFilters button").forEach((button) => {
  button.addEventListener("click", () => {
    document.querySelectorAll("#taskFilters button").forEach((item) => item.classList.remove("active"));
    button.classList.add("active");
    taskFilter = button.dataset.filter;
    renderTasks();
  });
});

els.taskForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const name = els.taskName.value.trim();
  if (!name) return;
  tasks.unshift({
    id: makeId(),
    name,
    deadline: els.taskDeadline.value || "17:30",
    duration: Number(els.taskDuration.value),
    priority: els.taskPriority.value,
    category: name.toLowerCase().includes("deck") || name.toLowerCase().includes("presentation") ? "presentation" : "custom",
    status: "pending",
    overdue: false,
    recipient: els.recipientInput.value || "Stakeholder"
  });
  proof(`Captured "${name}" and sent it to the analyzer`);
  onboarding.task = true;
  els.taskName.value = "";
  showToast("Task captured and rescored.");
  await refreshAnalysis();
});

document.querySelectorAll("[data-preset]").forEach((button) => {
  button.addEventListener("click", () => {
    const preset = button.dataset.preset;
    if (preset === "Presentation due soon") {
      els.taskName.value = "Finish presentation deck";
      els.taskPriority.value = "critical";
      els.taskDuration.value = "2";
      els.taskDeadline.value = "11:30";
    }
    if (preset === "Bug before demo") {
      els.taskName.value = "Fix demo blocking bug";
      els.taskPriority.value = "high";
      els.taskDuration.value = "1.5";
      els.taskDeadline.value = "13:00";
    }
    if (preset === "Email follow-up") {
      els.taskName.value = "Send stakeholder update";
      els.taskPriority.value = "medium";
      els.taskDuration.value = "0.5";
      els.taskDeadline.value = "16:00";
    }
    els.taskName.focus();
    showToast("Preset loaded. Press Add task.");
  });
});

document.querySelector("#addTask").addEventListener("click", () => els.taskName.focus());
document.querySelector("#panicMode").addEventListener("click", () => enterPanicMode());
document.querySelectorAll("[data-stress]").forEach((button) => {
  button.addEventListener("click", () => {
    els.panicText.value = button.dataset.stress;
    els.panicText.focus();
  });
});
document.querySelector("#sendPanic").addEventListener("click", () => {
  const text = els.panicText.value.trim();
  if (!text) return;
  els.panicText.value = "";
  enterPanicMode(text);
});
document.querySelector("#reshuffle").addEventListener("click", runTetris);
document.querySelector("#whatNow").addEventListener("click", () => {
  const nextTask = tasks.find((task) => task.id === latestAnalysis?.next_task_id) || chooseLocalNext();
  const message = nextTask
    ? `Do "${nextTask.name}" first because it has ${nextTask.priority} priority, needs ${nextTask.duration}h, and is due at ${nextTask.deadline}.`
    : "There is no pending task. Add work or take a short recovery block.";
  appendLine("Coach", message);
  proof("Explained the next recommended move");
  showToast("Next move explained in the coach panel.");
});
document.querySelector("#calendarRun").addEventListener("click", runTetris);
document.querySelector("#calendarRunTop").addEventListener("click", runTetris);
document.querySelector("#addFocusBlock").addEventListener("click", () => {
  const block = { id: makeId(), time: "15:30", title: "New protected focus block", type: "focus", locked: false };
  events.push(block);
  events = events.sort((a, b) => a.time.localeCompare(b.time));
  proof("Added a new flexible focus block to the calendar");
  showToast("Focus block added.");
  renderCalendar();
});
document.querySelector("#clearMoves").addEventListener("click", () => {
  events = clone(calendarSeed);
  proof("Reset calendar moves");
  showToast("Calendar reset.");
  renderCalendar();
});
document.querySelector("#draftEmails").addEventListener("click", async () => {
  if (backendOnline) {
    const result = await api("/api/draft-email").catch(() => ({ variants: fallbackEmails(), reason: "Generated locally." }));
    latestEmails = result.variants;
    proof(`Drafted email variants because: ${result.reason}`);
  } else {
    latestEmails = fallbackEmails();
    proof("Generated local email variants without backend");
  }
  onboarding.email = true;
  showToast("Context-aware drafts generated.");
  renderEmails();
  renderHabit();
  renderOnboarding();
});
document.querySelector("#draftEmailsTop").addEventListener("click", () => document.querySelector("#draftEmails").click());
document.querySelector("#approveEmail").addEventListener("click", () => {
  const mail = (latestEmails.length ? latestEmails : fallbackEmails())[selectedEmail];
  els.approvalCopy.textContent = `Approved: "${mail.subject}". Sending is still approval-gated; this demo stages the Gmail action instead of silently sending.`;
  proof(`Approved ${mail.tone.toLowerCase()} deadline negotiation draft`);
  showToast("Draft approved and staged.");
  renderHabit();
});
document.querySelector("#doNext").addEventListener("click", async () => {
  const id = latestAnalysis?.next_task_id;
  const nextTask = tasks.find((task) => task.id === id) || chooseLocalNext();
  if (!nextTask) return;
  nextTask.status = "in_progress";
  nextTask.overdue = false;
  proof(`Started "${nextTask.name}" as the next best action`);
  showToast(`Started ${nextTask.name}`);
  await refreshAnalysis();
});
document.querySelector("#completeFocus").addEventListener("click", async () => {
  const activeTask = tasks.find((task) => task.status === "in_progress") || tasks.find((task) => task.id === latestAnalysis?.next_task_id) || chooseLocalNext();
  if (!activeTask) return;
  activeTask.status = "done";
  activeTask.overdue = false;
  proof(`Completed focus task "${activeTask.name}"`);
  showToast("Focus task completed.");
  await refreshAnalysis();
});
document.querySelectorAll("[data-integration]").forEach((input) => {
  input.addEventListener("change", () => {
    proof(`${input.dataset.integration} ${input.checked ? "enabled" : "paused"}`);
    showToast(`${input.dataset.integration} ${input.checked ? "enabled" : "paused"}.`);
    renderHabit();
  });
});
document.querySelector("#exportProof").addEventListener("click", async () => {
  const text = proofLog.map((item, index) => `${index + 1}. ${item}`).join("\n");
  await navigator.clipboard?.writeText(text).catch(() => undefined);
  showToast("Proof log copied to clipboard.");
});
document.querySelector("#runLabScan")?.addEventListener("click", () => {
  detectedArchetype = analyzeArchetype();
  proof(`Lucid Lab scan detected ${detectedArchetype.name}`);
  showToast("Full behavioral scan complete.");
  renderLab();
  renderHabit();
});
document.querySelector("#detectArchetype")?.addEventListener("click", () => {
  detectedArchetype = analyzeArchetype();
  proof(`Archetype Engine classified current pattern as ${detectedArchetype.name}`);
  showToast(`${detectedArchetype.name} profile detected.`);
  renderLab();
});
document.querySelector("#applyArchetype")?.addEventListener("click", async () => {
  const profile = detectedArchetype || analyzeArchetype();
  const nextTask = chooseLocalNext();
  if (profile.name === "Overwhelmed" && nextTask) {
    tasks.unshift({ id: makeId(), name: `Micro-step: first 15 minutes of ${nextTask.name}`, deadline: nextTask.deadline, duration: 0.25, priority: nextTask.priority, category: "micro-step", status: "pending", overdue: false, recipient: nextTask.recipient });
  }
  if (profile.name === "Thrill-Seeker" && nextTask) {
    nextTask.deadline = "10:45";
  }
  if (profile.name === "Avoider" && nextTask) {
    els.panicText.value = `I am avoiding ${nextTask.name} and need the first two sentences.`;
    await switchView("dashboard");
    els.panicText.focus();
  }
  if (profile.name === "Busy Fool" && nextTask) {
    nextTask.status = "in_progress";
  }
  if (profile.name === "Perfectionist" && nextTask) {
    events.push({ id: makeId(), time: "11:45", title: `Good-enough lock: ${nextTask.name}`, type: "focus", locked: false, moved: true });
  }
  if (profile.name === "Dreamer") {
    els.taskDuration.focus();
  }
  proof(`Applied ${profile.name} intervention: ${profile.intervention}`);
  showToast("Archetype intervention applied.");
  await refreshAnalysis();
});
els.screenContext?.addEventListener("change", () => {
  screenContext = els.screenContext.value;
  const actions = {
    docs: "Screen context logged productive focus",
    youtube: "Screen context escalated off-task intervention ladder",
    email: "Screen context surfaced communication debt",
    calendar: "Screen context suggested Calendar Tetris",
    locked: "Screen context logged recovery break"
  };
  proof(actions[screenContext] || "Screen context updated");
  showToast("Screen context updated.");
  renderLab();
});
document.querySelector("#generateStake")?.addEventListener("click", () => {
  const stakes = [
    "Stake: post a short miss report if this slips.",
    "Stake: donate $5 to a cause you would rather avoid if the commitment misses.",
    "Stake: send a transparent Slack-style update explaining what changed.",
    "Stake: publish a green-check completion card when done."
  ];
  const pick = stakes[Math.floor(Math.random() * stakes.length)];
  els.stakeCopy.textContent = pick;
  proof("Pressure Cooker generated a social stake");
});
document.querySelector("#addCommitment")?.addEventListener("click", () => {
  const nextTask = chooseLocalNext();
  const title = els.commitmentInput.value.trim() || `Ship ${nextTask?.name || "the highest-risk task"} by ${nextTask?.deadline || "today"}`;
  const stake = els.stakeCopy.textContent.replace(/^Stake:\s*/i, "");
  commitments.unshift({ id: makeId(), title, stake, visibility: els.commitmentVisibility.value, status: "active" });
  els.commitmentInput.value = "";
  proof(`Pressure Cooker created ${els.commitmentVisibility.value} commitment: ${title}`);
  showToast("Commitment card created.");
  renderCommitments();
  renderHabit();
});
document.querySelector("#runPremortem")?.addEventListener("click", generatePremortem);
els.emotionButtons?.querySelectorAll("[data-emotion]").forEach((button) => {
  button.addEventListener("click", () => {
    els.emotionButtons.querySelectorAll("button").forEach((item) => item.classList.remove("active"));
    button.classList.add("active");
    const id = els.emotionTask.value || tasks[0]?.id;
    if (!id) return;
    emotionLog[id] = emotionLog[id] || [];
    emotionLog[id].push({ emotion: button.dataset.emotion, time: new Date().toISOString() });
    proof(`Emotional Velocity recorded ${button.dataset.emotion} for ${tasks.find((task) => task.id === id)?.name || "task"}`);
    showToast("Emotional signal recorded.");
    renderVelocity();
    renderHabit();
  });
});
els.emotionTask?.addEventListener("change", renderVelocity);
document.querySelector("#queueOvernight")?.addEventListener("click", () => {
  overnightJobs.unshift({ type: els.overnightType.value, status: "queued", output: "" });
  proof(`Queued overnight ${els.overnightType.value} job`);
  showToast("Overnight job queued.");
  renderOvernight();
  renderHabit();
});
document.querySelector("#runOvernight")?.addEventListener("click", () => {
  overnightJobs.forEach((job, index) => {
    if (job.status === "queued") completeOvernightJob(index);
  });
  if (!overnightJobs.some((job) => job.status === "queued")) {
    overnightJobs.unshift({ type: els.overnightType.value, status: "queued", output: "" });
    completeOvernightJob(0);
  }
  renderOvernight();
  renderHabit();
});
document.querySelector("#buildGraph")?.addEventListener("click", () => {
  proof("Conflict Graph rebuilt from task deadlines, categories, energy, and calendar flexibility");
  showToast("Conflict graph rebuilt.");
  renderConflictGraph();
  renderHabit();
});
document.querySelector("#demoReset").addEventListener("click", async () => {
  tasks = clone(demoTasks);
  events = clone(calendarSeed);
  selectedEmail = 0;
  latestEmails = [];
  latestHabit = null;
  detectedArchetype = null;
  emotionLog = {};
  commitments = [];
  overnightJobs = [
    { type: "research", status: "ready", output: "Prepared a 5-bullet research brief from your highest-risk task." },
    { type: "email", status: "ready", output: "Prepared 3 stakeholder update drafts for the next likely missed deadline." }
  ];
  selectedMood = "steady";
  moodScore = -8;
  proofLog = ["Loaded 4 tasks and detected 1 overdue item", "Waiting for local backend analysis"];
  document.querySelectorAll(".mood").forEach((item) => item.classList.remove("active"));
  document.querySelector("[data-mood='steady']").classList.add("active");
  els.transcript.innerHTML = "<p><strong>Coach</strong> Tell me what is making today feel impossible. I will triage it against your real queue.</p>";
  els.calendarSummary.textContent = "Run Optimize to create a plan from your current tasks and flexible events.";
  showToast("Demo reset.");
  await refreshAnalysis();
  renderEmails();
  renderLab();
});

(async function boot() {
  await checkBackend();
  await refreshAnalysis();
  renderEmails();
  window.setInterval(refreshAnalysis, 30000);
})();
