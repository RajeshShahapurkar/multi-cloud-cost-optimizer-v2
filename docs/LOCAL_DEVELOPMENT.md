# Local Development

Requirements: Python 3.11+, Node.js 20+, npm.

## Backend (PowerShell)
```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
Copy-Item .env.example .env
uvicorn app.main:app --reload --port 8000
```
API docs: http://localhost:8000/docs

## Frontend
```powershell
cd frontend
npm install
Copy-Item .env.example .env.local
npm run dev
```
Frontend: http://localhost:3000

## Tests
```powershell
cd backend
pytest
```

The initial slice exposes preview endpoints only. Persistence and authentication will be added after Supabase project selection and RLS setup. Never commit environment files or credentials.
