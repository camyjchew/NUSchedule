# NUS Timetable App

A timetable coordination app for NUS students. Users can view their own timetable and compare it with a group to find free slots.

## Tech Stack
- **Frontend**: React + Vite
- **Backend**: Python Flask
- **Database**: SQLite

## Project Structure
```
orbital/
├── backend/
│   ├── app.py              # Flask app with routes
│   ├── database.py         # SQLite initialization and helpers
│   └── timetable.db        # SQLite database (auto-created)
└── frontend/
    ├── index.html
    ├── package.json
    ├── vite.config.js
    ├── src/
    │   ├── main.jsx
    │   ├── App.jsx
    │   ├── data/
    │   │   └── dummyData.js
    │   └── components/
    │       ├── TimetableGrid.jsx
    │       ├── GroupView.jsx
    │       └── SlotBlock.jsx
```

## Getting Started

### Backend
```bash
cd backend
pip install flask
python app.py
```

### Frontend
```bash
cd frontend
npm install
npm run dev
```
