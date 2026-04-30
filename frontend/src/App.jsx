import React, { useState, useEffect } from 'react';
import TimetableGrid from './components/TimetableGrid';
import GroupView from './components/GroupView';
import { NUSMODS_MODULE_DATA } from './data/dummyData';
import LoginScreen from './LoginScreen';
import './App.css';

export default function App() {
  const [nusmodsData] = useState(NUSMODS_MODULE_DATA);
  const [currentUserId, setCurrentUserId] = useState(() => {
    if (typeof window === 'undefined') {
      return null;
    }

    const stored = window.localStorage.getItem('currentUserId');
    return stored ? Number(stored) : null;
  });
  const [moduleSelections, setModuleSelections] = useState([]);
  const [customEvents, setCustomEvents] = useState([]);
  const [mergedSlots, setMergedSlots] = useState([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState('personal'); // 'personal' or 'group'

  // Helper function to get color for a module
  const getColorForModule = (moduleCode) => {
    const colors = {
      CS2030S: '#6366f1',
      MA2001: '#ec4899',
      IS1108: '#f59e0b'
    };
    return colors[moduleCode] || '#60a5fa';
  };

  // Pure function to merge slots from module selections and custom events
  const mergeSlots = (selections, events, modulesData) => {
    const slots = [];

    // Process module selections
    selections.forEach(selection => {
      const module = modulesData[selection.moduleCode || selection.module_code];
      if (module) {
        const lessonSlot = module.semesterData[0].timetable.find(
          t =>
            t.lessonType === (selection.lessonType || selection.lesson_type) &&
            t.classNo === (selection.classNo || selection.class_no)
        );

        if (lessonSlot) {
          const moduleCode = selection.moduleCode || selection.module_code;
          const lessonType = selection.lessonType || selection.lesson_type;
          const classNo = selection.classNo || selection.class_no;

          slots.push({
            id: `${moduleCode}-${lessonType}-${classNo}`,
            title: `${moduleCode} ${lessonType}`,
            day: lessonSlot.day,
            startTime: lessonSlot.startTime,
            endTime: lessonSlot.endTime,
            type: 'nusmods',
            venue: lessonSlot.venue,
            color: getColorForModule(moduleCode),
            moduleCode,
            lessonType,
            classNo,
            weeks: lessonSlot.weeks
          });
        }
      }
    });

    // Process custom events
    events.forEach(event => {
      slots.push({
        id: event.id,
        title: event.title,
        day: event.day,
        startTime: event.startTime || event.start_time,
        endTime: event.endTime || event.end_time,
        type: 'custom',
        color: event.color,
        venue: null
      });
    });

    return slots;
  };

  // Load initial data on mount
  useEffect(() => {
    if (!currentUserId) {
      setModuleSelections([]);
      setCustomEvents([]);
      setMergedSlots([]);
      setLoading(false);
      return;
    }

    const loadData = async () => {
      setLoading(true);
      try {
        // Fetch user's timetable from backend
        const response = await fetch(`/timetable?userId=${currentUserId}`);
        if (!response.ok) throw new Error('Failed to fetch timetable');

        const data = await response.json();
        const fetchedSelections = data.moduleSelections || [];
        const fetchedEvents = data.customEvents || [];

        // Normalize the API response format to our naming conventions
        const normalizedSelections = fetchedSelections.map(s => ({
          moduleCode: s.moduleCode || s.module_code,
          lessonType: s.lessonType || s.lesson_type,
          classNo: s.classNo || s.class_no
        }));

        const normalizedEvents = fetchedEvents.map(e => ({
          id: e.id,
          title: e.title,
          day: e.day,
          startTime: e.startTime || e.start_time,
          endTime: e.endTime || e.end_time,
          color: e.color
        }));

        setModuleSelections(normalizedSelections);
        setCustomEvents(normalizedEvents);

        // Merge slots
        const merged = mergeSlots(normalizedSelections, normalizedEvents, nusmodsData);
        setMergedSlots(merged);

        const needsSync =
          JSON.stringify(normalizedSelections) !== JSON.stringify(fetchedSelections) ||
          JSON.stringify(normalizedEvents) !== JSON.stringify(fetchedEvents);

        if (needsSync) {
          await fetch(`/timetable/update?userId=${currentUserId}`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              userId: currentUserId,
              moduleSelections: normalizedSelections,
              customEvents: normalizedEvents
            })
          });
        }
      } catch (error) {
        console.error('Error loading timetable:', error);
        // Fall back to dummy data on error
        setModuleSelections([
          { moduleCode: 'CS2030S', lessonType: 'Lecture', classNo: '1' },
          { moduleCode: 'CS2030S', lessonType: 'Tutorial', classNo: '04' },
          { moduleCode: 'MA2001', lessonType: 'Lecture', classNo: '1' },
          { moduleCode: 'MA2001', lessonType: 'Tutorial', classNo: '01' }
        ]);
        setCustomEvents([
          {
            id: 'custom-1',
            title: 'Gym',
            day: 'Friday',
            startTime: '0800',
            endTime: '0900',
            color: '#34d399'
          }
        ]);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [currentUserId, nusmodsData]);

  // Re-merge slots whenever selections or events change
  useEffect(() => {
    const merged = mergeSlots(moduleSelections, customEvents, nusmodsData);
    setMergedSlots(merged);
  }, [moduleSelections, customEvents, nusmodsData]);

  const handleLogin = (userId) => {
    window.localStorage.setItem('currentUserId', String(userId));
    setCurrentUserId(userId);
    setView('personal');
  };

  const handleSwitchUser = () => {
    window.localStorage.removeItem('currentUserId');
    setCurrentUserId(null);
    setModuleSelections([]);
    setCustomEvents([]);
    setMergedSlots([]);
    setView('personal');
    setLoading(false);
  };

  if (!currentUserId) {
    return <LoginScreen onLogin={handleLogin} />;
  }

  if (loading) {
    return <div className="app-loading">Loading timetable data...</div>;
  }

  return (
    <div className="app-container">
      <header className="app-header">
        <div className="header-content">
          <div>
            <h1>NUS Timetable Coordinator</h1>
            <p>View and manage your schedule</p>
          </div>
          <button className="switch-user-button" type="button" onClick={handleSwitchUser}>
            Switch User
          </button>
        </div>
        <nav className="nav-tabs">
          <button
            className={`nav-tab ${view === 'personal' ? 'active' : ''}`}
            onClick={() => setView('personal')}
          >
            My Timetable
          </button>
          <button
            className={`nav-tab ${view === 'group' ? 'active' : ''}`}
            onClick={() => setView('group')}
          >
            Group View
          </button>
        </nav>
      </header>

      <main className="app-main">
        {view === 'personal' && (
          <section className="personal-view">
            <div className="section-header">
              <h2>Your Timetable</h2>
              <div className="slot-legend">
                <div className="legend-item">
                  <div className="legend-box solid"></div>
                  <span>NUSMods Classes</span>
                </div>
                <div className="legend-item">
                  <div className="legend-box dashed"></div>
                  <span>Custom Events</span>
                </div>
              </div>
            </div>
            <TimetableGrid slots={mergedSlots} />
            <div className="slots-summary">
              <p>Showing {mergedSlots.length} total slots this week</p>
            </div>
          </section>
        )}

        {view === 'group' && (
          <section className="group-view-section">
            <GroupView groupId={1} nusmodsData={nusmodsData} />
          </section>
        )}
      </main>

      <footer className="app-footer">
        <p>NUS Timetable App &copy; 2024 — Minimal Implementation</p>
      </footer>
    </div>
  );
}
