# LucidSprint

LucidSprint is a deadline-pressure productivity assistant built for the Vibe2Ship hackathon. It helps users turn overwhelm into a clear sprint plan by combining cognitive load scoring, task triage, calendar repair, email negotiation, behavioral profiling, emotional velocity tracking, and proof-of-work history.

## Why It Matters

Most productivity tools remind people what they already know: there is too much to do. LucidSprint focuses on the moment when someone is overloaded and needs help deciding what to do next. It predicts failure patterns early, prevents deadline spirals with targeted interventions, and prepares useful work so the user can recover momentum quickly.

## Core Features

- **Cognitive Load Score**: Scores workload from task urgency, overdue debt, task duration, mood, completion relief, and time-of-day energy.
- **Guided Triage Coach**: Turns natural-language stress messages into focused action plans instead of returning generic responses.
- **Smart Calendar Tetris**: Protects locked events and moves flexible blocks to create focus time for urgent work.
- **Deadline Negotiator**: Generates three approval-gated email variants for deadline extension or stakeholder updates.
- **Voice Panic Mode Simulation**: Provides a triage-style flow for moments when the user feels blocked or overwhelmed.
- **Habit DNA**: Shows productivity patterns, scheduling rules, and proof of what changed during the session.
- **Proof-of-Work Trail**: Logs interventions so the user and judges can audit what the assistant actually did.

## Lucid Lab Differentiators

LucidSprint includes a dedicated **Lucid Lab** section with advanced, hackathon-ready differentiators:

- **Deadline Personality Profiling**: Detects patterns such as Perfectionist, Overwhelmed, Thrill-Seeker, Dreamer, Avoider, and Busy Fool.
- **Screen Context Awareness Simulation**: Models permission-based context signals such as Docs, YouTube, Email, Calendar, and break states.
- **Pressure Cooker Accountability**: Creates social commitment cards with stakes, completion states, and miss reports.
- **Pre-Mortem Engine**: Asks why a high-stakes task might fail, then generates prevention steps and schedules a prevention block.
- **Emotional Velocity**: Tracks how the user feels about each task over time and flags declining emotional momentum.
- **Overnight Autopilot**: Queues asynchronous prep tasks such as research summaries, email drafts, agendas, document summaries, and weekly reports.
- **Conflict Graph**: Detects hidden blockers across task priority, deadlines, communication avoidance, energy, and calendar flexibility.

## Tech Stack

- **Frontend**: HTML, CSS, vanilla JavaScript
- **Backend**: Python standard-library HTTP server
- **Storage**: In-memory demo state for hackathon flow
- **Assets**: Generated realistic product visuals stored in `assets/`
- **APIs**: Local JSON endpoints for analysis, triage, calendar optimization, email drafting, and habit insights

## Project Structure

```text
LucidSprint/
├── assets/
│   ├── lucidsprint-hero.png
│   ├── mini-calendar.png
│   ├── mini-email.png
│   ├── mini-lab.png
│   └── mini-workload.png
├── app.js
├── index.html
├── server.py
├── styles.css
└── README.md
```

## Run Locally

```powershell
git clone https://github.com/Parthivi-Jain-24/LucidSprint.git
cd LucidSprint
python server.py
```

Open:

```text
http://127.0.0.1:5177/
```

If the browser shows an older design, hard refresh with `Ctrl + F5`.

## Local Endpoints

- `GET /api/health`
- `POST /api/analyze`
- `POST /api/triage`
- `POST /api/calendar-tetris`
- `POST /api/draft-email`
- `POST /api/habit-dna`

## Deploy on Vercel

LucidSprint can be deployed on Vercel as one project with both frontend and backend:

- The frontend is served from `index.html`, `styles.css`, `app.js`, and `assets/`.
- The backend is served from Python serverless functions inside `api/`.
- The deployed app keeps the same API paths used locally, such as `/api/analyze` and `/api/triage`.

### Option 1: Deploy from GitHub

1. Push the repository to GitHub.
2. Open [Vercel](https://vercel.com/).
3. Choose **Add New Project**.
4. Import `Parthivi-Jain-24/LucidSprint`.
5. Use these settings:
   - **Framework Preset**: Other
   - **Build Command**: leave empty
   - **Output Directory**: leave empty
   - **Install Command**: leave empty
6. Click **Deploy**.

After deployment, open the Vercel URL and test:

```text
https://your-vercel-url.vercel.app/api/health
```

It should return:

```json
{"ok": true, "name": "LucidSprint Vercel API"}
```

### Option 2: Deploy with Vercel CLI

```powershell
npm install -g vercel
vercel login
vercel
```

When Vercel asks for setup choices, keep the defaults and deploy from the project root.

## Demo Flow

1. Start on the home page and choose **Start with a problem**.
2. Add or edit deadline tasks in the Workload section.
3. Change mood to update the Cognitive Load Score.
4. Use the coach with inputs such as:
   - `Presentation due in 2 hours and I have not started`
   - `Demo bug is blocking submission`
   - `Too many tasks due today and I do not know what to do first`
5. Run Calendar Tetris to protect focus time.
6. Draft a deadline negotiation email.
7. Open Lucid Lab and run the full behavioral scan.

## Hackathon Pitch

LucidSprint is not just another task manager. It is a deadline intervention system. It understands when pressure is rising, detects the behavioral pattern behind the delay, creates a focused plan, protects calendar time, drafts communication, and records proof of progress. The product is designed for students, builders, founders, and professionals who need practical help in the final hours before an important deadline.

## Future Integrations

- Gemini API for deeper triage and behavioral reasoning
- Google Calendar OAuth for real calendar reshuffling
- Gmail API for approval-gated send flows
- Firebase Firestore for persistent task and habit history
- Browser speech recognition for live Voice Panic Mode
- Optional Chrome extension for permission-based screen context

## Repository Description

AI-powered deadline pressure assistant with cognitive load scoring, smart triage, calendar repair, email negotiation, behavioral profiling, emotional velocity tracking, and proof-of-work history.
