# Neurax Autonomous Workflow AI Agent

Neurax is a React + Django REST autonomous planning platform with smart staffing, tool recommendations, and replanning.

## Core upgrades

- OpenAI migration (`gpt-4o`) with backend `.env` key loading (`OPENAI_API_KEY`).
- Fallback deterministic planner remains active when no key is set.
- v2 dataset support for Excel files:
	- `neurax_employees_v2.xlsx`
	- `neurax_projects_v2.xlsx`
	- `neurax_tools_v2.xlsx`
	- `neurax_project_history_v2.xlsx`
- Animated SaaS intro screen with logo reveal, typewriter tagline, and workspace transition.
- Active Assignments live sidebar section (currently assigned + available workforce).
- Employee directory pagination for 100+ rows with deterministic performance rating (`1-10`).
- Smart assignment logic with:
	- skill match scoring
	- capacity weighting
	- performance weighting
	- deadline risk flags
	- reassignment alerts for deadline pressure
- Task priorities (`High`, `Medium`, `Low`) with filter support in Task Board.
- Tool recommendation cards per task (top 3 with match reason).

## Folder notes

- Backend API: [backend](backend)
- Frontend app: [frontend](frontend)
- Data files: [backend/data](backend/data)

## Environment setup

Use templates:

- [backend/.env.example](backend/.env.example)
- [frontend/.env.example](frontend/.env.example)
- [/.env.example](.env.example)

Backend `.env` example:

```env
OPENAI_API_KEY=your_openai_key_here
DEBUG=True
ALLOWED_HOSTS=localhost,127.0.0.1
```

Frontend `.env` example:

```env
VITE_API_BASE_URL=http://localhost:8000/api
```

## Run the backend

```bash
cd backend
pip install -r requirements.txt
python manage.py migrate
python manage.py runserver 8000
```

## Run the frontend

```bash
cd frontend
npm install
npm run dev
```

Open: `http://localhost:3000`

## API endpoints

- `POST /api/agent/run/`
- `POST /api/agent/replan/`
- `GET /api/employees/`
- `GET /api/projects/`
- `GET /api/tools/`
- `GET /api/history/`

## Data loading behavior

- The backend tries v2 Excel files first, then falls back to legacy CSV datasets.
- Datasets are preloaded at startup and embedded into the LLM planning context.

## Security note

- Keep API keys server-side only (`backend/.env`).
- Do not place OpenAI keys in frontend environment variables.
