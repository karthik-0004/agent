# Neurax Autonomous Workflow AI Agent

React frontend and Django REST backend for autonomous task orchestration, team matching, tool selection, and replanning against CSV datasets.

## Backend

```bash
cd backend
pip install -r requirements.txt
python manage.py migrate
python manage.py runserver
```

Backend environment file:

```env
ANTHROPIC_API_KEY=your_key_here
DEBUG=True
ALLOWED_HOSTS=localhost,127.0.0.1
```

## Frontend

```bash
cd frontend
npm install
npm run dev
```

Frontend environment file:

```env
VITE_API_BASE_URL=http://localhost:8000/api
```

## Available API endpoints

- `POST /api/agent/run/`
- `POST /api/agent/replan/`
- `GET /api/employees/`
- `GET /api/projects/`
- `GET /api/tools/`
- `GET /api/history/`

## Notes

- All four CSV datasets live in `backend/data/`.
- Django preloads the CSV datasets on app startup using pandas.
- The agent embeds employees, tools, and project history datasets in the Anthropic system prompt for planning.
- If an Anthropic key is not configured, the backend falls back to a deterministic local planner so the UI remains usable.
