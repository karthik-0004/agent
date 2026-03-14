# Neurax Taskifier

Manager-first autonomous workflow platform built with React + Django REST.

## What this version focuses on

- The Karthik Rule: G. Karthikeyan is always pinned as team slot #1.
- Team size behavior:
	- 1: only Karthik
	- 2-5: Karthik + reshuffled best-match members
- Reshuffle never replaces Karthik.
- Confirmed team can trigger assignment emails from Mission Control.
- Mission Control input first: manager writes the mission and selects team size (1-5).
- Clean plan summary in under 5 seconds: project, priority, team size, deadline.
- Assigned Team card with role and availability status.
- Employee management with full CRUD:
	- add new employee
	- edit employee
	- delete employee with confirmation
- Employee directory built for large datasets:
	- search by name/role/skill
	- pagination (12 per page)
	- deterministic rating (1-10)
	- status pill (assigned/available)
- Task Board redesigned to project buckets with team progress bars.
- Past Projects and Projects as expandable cards with compact-to-detailed interaction.
- Tools section fixed to map dataset fields correctly:
	- `tool_name` -> `name`
	- `purpose` -> `purpose_keywords`
	- `supported_languages` -> `supported_skills`
	- paginated catalog for all tools.

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
- `POST /api/agent/send-assignments/`
- `GET /api/employees/`
- `POST /api/employees/`
- `PUT /api/employees/<employee_id>/`
- `DELETE /api/employees/<employee_id>/`
- `GET /api/projects/`
- `GET /api/tools/`
- `GET /api/history/`

## Data loading behavior

- Loader checks v2 datasets first (`.xlsx`, then `.csv`) and falls back to legacy CSV files.
- Supported input roots:
	- `backend/data`
	- `datasets`
- Canonical field mapping is applied server-side so frontend cards always receive stable keys.

## Security note

- Keep API keys server-side only (`backend/.env`).
- Do not place OpenAI keys in frontend environment variables.

## SMTP setup for assignment emails

Set these in `backend/.env`:

```env
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_HOST_USER=237r1a3327@cmrtc.ac.in
EMAIL_HOST_PASSWORD=your-gmail-app-password
EMAIL_USE_TLS=True
EMAIL_FROM_NAME=Neurax Taskifier
```

Gmail requires a 16-character App Password (not your normal account password):

1. Google Account -> Security
2. Enable 2-Step Verification
3. Open App Passwords
4. Generate an app password for Mail
