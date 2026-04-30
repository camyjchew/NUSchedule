# Setup Instructions

This project requires both a backend (Flask) and frontend (React + Vite) to run.

## Prerequisites
- Python 3.8+
- Node.js 16+ (with npm)

## Backend Setup

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

The backend will start on `http://localhost:5000`.

**Expected output:**
```
 * Running on http://127.0.0.1:5000
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
```

### 3. Start the development server
```bash
npm run dev
```

The frontend will start on `http://localhost:3000` and automatically proxy API calls to the backend.

---

## Testing

1. Backend is running on `http://localhost:5000`
2. Frontend is running on `http://localhost:3000`

Open `http://localhost:3000` in your browser.

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
