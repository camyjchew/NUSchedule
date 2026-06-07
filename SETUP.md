# Setup Instructions

This project requires both a backend (Flask) and frontend (React + Vite) to run.

## Prerequisites
- Python 3.8+
- Node.js 16+ (with npm)


## Backend Setup

# Quick Copy
cd backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
python app.py

# Quick Copy
cd frontend
npm install
npm run dev

### 1. Navigate to backend directory
```bash
cd backend
```

### 2. Create a virtual environment (recommended)
```bash
python3 -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
```

### 3. Install dependencies
```bash
pip install -r requirements.txt
```

### 4. Run the Flask server
```bash
python app.py
```

The backend will start on `http://localhost:5001` by default (the Flask app sets port 5001).

**Expected output:**
```
 * Running on http://127.0.0.1:5001
 * Press CTRL+C to quit
```

The database will be auto-created on first run with dummy data.

---


## Frontend Setup

### 1. Navigate to frontend directory (in a new terminal)
```bash
cd frontend
```

### 2. Install dependencies
```bash
npm install
# or for reproducible installs use:
# npm ci
```

### 3. Start the development server
```bash
npm run dev
```

The frontend will start on `http://localhost:3000` and automatically proxy API calls to the backend.

Note: the proxy in `vite.config.js` targets port `5001` by default, so ensure the backend is running first.

Run the backend in one terminal and the frontend in another terminal.

### Login / Demo Accounts

The app includes 3 demo accounts you can pick from on the login screen:

- Alice
- Bob
- Charlie

There is also a blank-account creation flow for testing. Enter any name and email you want.

You can also create a new blank account from the login screen. It starts with an empty timetable and no custom events.

The backend uses a session cookie after login, so once you choose an account the timetable requests will use that logged-in user automatically.

Custom events can be added from the timetable screen and will appear immediately in the UI for testing.
They are currently kept local to the current session and can be discarded when switching users.

---

## Testing

1. Backend is running on `http://localhost:5001`
2. Frontend is running on `http://localhost:3000`

Open `http://localhost:3000` in a browser.

### Features to Test

#### Personal View (My Timetable)
- Shows Alice's (user ID 1) timetable
- Should display:
  - CS2030S Lecture on Monday 14:00-16:00
  - CS2030S Tutorial on Wednesday 10:00-11:00
  - MA2001 Lecture on Tuesday 10:00-12:00
  - MA2001 Tutorial on Thursday 14:00-15:00
  - Custom "Gym" event on Friday 08:00-09:00

#### Group View
- Click "Group View" tab
- Shows timetables for Alice, Bob, and Charlie
- Toggle buttons allow filtering by member
- Should display all members' schedules overlaid

---

## API Endpoints

### `GET /timetable`
Returns current user's (user ID 1) module selections and custom events.

**Response:**
```json
{
  "moduleSelections": [
    { "moduleCode": "CS2030S", "lessonType": "Lecture", "classNo": "1" }
  ],
  "customEvents": [
    { "id": "custom-1", "title": "Gym", "day": "Friday", "startTime": "0800", "endTime": "0900", "color": "#34d399" }
  ]
}
```

### `POST /timetable/update`
Updates current user's timetable.

**Request:**
```json
{
  "moduleSelections": [...],
  "customEvents": [...]
}
```

### `GET /group/<id>`
Returns group with all members' timetable data.

### `POST /group`
Creates a new group.

**Request:**
```json
{
  "name": "Group Name",
  "memberIds": [1, 2, 3]
}
```

---

## Database

The SQLite database (`backend/timetable.db`) is created automatically on first run with mock data:

- **Users**: Alice (ID 1), Bob (ID 2), Charlie (ID 3)
- **Modules**: CS2030S, MA2001, IS1108
- **Group**: "CS Project Group" with all 3 members

To reset the database, delete `timetable.db` and restart the backend.

Troubleshooting tips:
- If port 5001 is already in use, change the `port` value in `backend/app.py` or update the proxy in `frontend/vite.config.js` and restart both servers.
- If the frontend doesn't reflect changes, delete `node_modules/.vite` and restart the Vite dev server.
- If you want to switch accounts, use the login screen's demo users or create a new blank account.

---

## Development

### Making Changes

**Backend:**
- Edit `backend/app.py` or `backend/database.py`
- Flask auto-reloads on file changes

**Frontend:**
- Edit files in `frontend/src/`
- Vite hot-reloads on file changes

### Building for Production

Frontend:
```bash
cd frontend
npm run build
```

Output will be in `frontend/dist/`
