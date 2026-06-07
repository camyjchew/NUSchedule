import React, { useState, useEffect } from 'react';
import TimetableGrid from './components/TimetableGrid';
import GroupView from './components/GroupView';
import { NUSMODS_MODULE_DATA, MOCK_USERS } from './data/dummyData';
import LoginScreen from './LoginScreen';
import './App.css';

export default function App() {
  const [nusmodsData] = useState(NUSMODS_MODULE_DATA);
  const [currentUserId, setCurrentUserId] = useState(null);
  const [availableUsers, setAvailableUsers] = useState(MOCK_USERS);
  const [moduleSelections, setModuleSelections] = useState([]);
  const [customEvents, setCustomEvents] = useState([]);
  const [mergedSlots, setMergedSlots] = useState([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState('personal'); // 'personal' or 'group'
  const [currentUser, setCurrentUser] = useState(null);
  const [loginNotice, setLoginNotice] = useState('');
  const [eventDraft, setEventDraft] = useState({
    title: '',
    day: 'Monday',
    startTime: '0900',
    endTime: '1000',
    color: '#60a5fa'
  });
  const [selectedEvent, setSelectedEvent] = useState(null);

  // State variables:
  // - currentUserId: logged-in user id restored from the backend session.
  // - moduleSelections & customEvents: user's module selections and personal events.
  // - view: current UI mode, either 'personal' (own timetable) or 'group' (team overlay).

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

  // Restore the logged-in session on mount, then load timetable data.
  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.localStorage.removeItem('createdUsers');
    }

    const restoreSession = async () => {
      try {
        const response = await fetch('/me', { credentials: 'include' });

        if (response.ok) {
          const data = await response.json();
          setCurrentUserId(data.userId);
          setCurrentUser({
            userId: data.userId,
            name: data.name,
            email: data.email
          });
          return;
        }
      } catch (error) {
        console.error('Error restoring session:', error);
      }

      setModuleSelections([]);
      setCustomEvents([]);
      setMergedSlots([]);
      setLoading(false);
    };

    restoreSession();
  }, []);

  // Fetch users from backend so the login list reflects DB-created accounts.
  useEffect(() => {
    const loadUsers = async () => {
      try {
        const resp = await fetch('/users');
        if (!resp.ok) return;
        const data = await resp.json();
        const fromServer = (data.users || []).map(u => ({ id: u.id, name: u.name, email: u.email }));

        // Merge server users with the built-in mock users. The backend is the source of truth.
        setAvailableUsers(() => {
          const map = new Map();
          MOCK_USERS.concat(fromServer).forEach(u => map.set(u.id, u));
          return Array.from(map.values()).sort((a, b) => a.id - b.id);
        });
      } catch (e) {
        // ignore
      }
    };

    loadUsers();
  }, []);

  // Load timetable whenever the logged-in user changes.
  useEffect(() => {
    if (!currentUserId) {
      return;
    }

    const loadData = async () => {
      setLoading(true);
      try {
        // Fetch user's timetable from backend
        const response = await fetch(`/timetable?userId=${currentUserId}`, {
          credentials: 'include'
        });
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
            credentials: 'include',
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

  const handleLogin = async (userId) => {
    setLoginNotice('');
    const selectedUser = availableUsers.find((user) => user.id === userId) || {
      id: userId,
      name: `User ${userId}`,
      email: ''
    };

    await fetch('/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ userId })
    });

    setCurrentUserId(userId);
    setCurrentUser({
      userId: selectedUser.id,
      name: selectedUser.name,
      email: selectedUser.email
    });
    setView('personal');
  };

  const handleRegister = async (name, email) => {
    const response = await fetch('/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ name, email })
    });

    if (!response.ok) {
      throw new Error('Failed to create account');
    }

    const data = await response.json();
    setLoginNotice(`${name} account created. Click it in the list to log in.`);
    setAvailableUsers((prev) => {
      const nextUser = { id: data.userId, name, email };
      const nextUsers = prev.some((user) => user.id === nextUser.id)
        ? prev
        : [...prev, nextUser].sort((a, b) => a.id - b.id);

      return nextUsers;
    });
  };

  const handleSwitchUser = async () => {
    await fetch('/logout', {
      method: 'POST',
      credentials: 'include'
    });

    setCurrentUserId(null);
    setCurrentUser(null);
    setModuleSelections([]);
    setCustomEvents([]);
    setMergedSlots([]);
    setSelectedEvent(null);
    setView('personal');
    setLoading(false);
  };

  const handleAddCustomEvent = async () => {
    if (!eventDraft.title.trim()) {
      return;
    }

    const newEvent = {
      id: `custom-${Date.now()}`,
      title: eventDraft.title.trim(),
      day: eventDraft.day,
      startTime: eventDraft.startTime,
      endTime: eventDraft.endTime,
      color: eventDraft.color
    };

    const updatedEvents = [...customEvents, newEvent];
    setCustomEvents(updatedEvents);
    setEventDraft((draft) => ({ ...draft, title: '' }));
  };

  const handleCustomEventClick = (slot) => {
    setSelectedEvent(slot);
  };

  const handleDeleteSelectedEvent = () => {
    if (!selectedEvent) {
      return;
    }

    const updatedEvents = customEvents.filter((event) => event.id !== selectedEvent.id);
    setCustomEvents(updatedEvents);
    setSelectedEvent(null);
  };

  if (!currentUserId) {
    return (
      <LoginScreen
        users={availableUsers}
        notice={loginNotice}
        onLogin={handleLogin}
        onRegister={handleRegister}
      />
    );
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
          <div className="header-user-actions">
            <div className="logged-in-pill">
              Logged in as <strong>{currentUser?.name || `User ${currentUserId}`}</strong>
              {currentUser?.email ? <span>{currentUser.email}</span> : null}
            </div>
            <button className="switch-user-button" type="button" onClick={handleSwitchUser}>
              Switch User
            </button>
          </div>
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

            <div className="event-editor-card">
              <div className="event-editor-header">
                <div>
                  <h3>Add custom event</h3>
                  <p>Create personal events like gym, meetings, or reminders.</p>
                </div>
                <button className="event-editor-button" type="button" onClick={handleAddCustomEvent}>
                  Add event
                </button>
              </div>

              <div className="event-editor-grid">
                <label>
                  Title
                  <input
                    type="text"
                    value={eventDraft.title}
                    onChange={(event) => setEventDraft((draft) => ({ ...draft, title: event.target.value }))}
                    placeholder="Gym"
                  />
                </label>
                <label>
                  Day
                  <select
                    value={eventDraft.day}
                    onChange={(event) => setEventDraft((draft) => ({ ...draft, day: event.target.value }))}
                  >
                    {['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'].map((day) => (
                      <option key={day} value={day}>
                        {day}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Start
                  <input
                    type="time"
                    value={`${eventDraft.startTime.slice(0, 2)}:${eventDraft.startTime.slice(2, 4)}`}
                    onChange={(event) =>
                      setEventDraft((draft) => ({
                        ...draft,
                        startTime: event.target.value.replace(':', '')
                      }))
                    }
                  />
                </label>
                <label>
                  End
                  <input
                    type="time"
                    value={`${eventDraft.endTime.slice(0, 2)}:${eventDraft.endTime.slice(2, 4)}`}
                    onChange={(event) =>
                      setEventDraft((draft) => ({
                        ...draft,
                        endTime: event.target.value.replace(':', '')
                      }))
                    }
                  />
                </label>
                <label>
                  Color
                  <input
                    type="color"
                    value={eventDraft.color}
                    onChange={(event) => setEventDraft((draft) => ({ ...draft, color: event.target.value }))}
                  />
                </label>
              </div>
            </div>

            <TimetableGrid slots={mergedSlots} onSlotClick={handleCustomEventClick} />
            <div className="slots-summary">
              <p>Showing {mergedSlots.length} total slots this week</p>
            </div>
          </section>
        )}

        {view === 'group' && (
          <section className="group-view-section">
            <GroupView
              groupId={1}
              nusmodsData={nusmodsData}
              liveUserOverride={{
                userId: currentUserId,
                name: currentUser?.name || `User ${currentUserId}`,
                moduleSelections,
                customEvents
              }}
            />
          </section>
        )}
      </main>

      {selectedEvent ? (
        <div className="event-modal-backdrop" onClick={() => setSelectedEvent(null)}>
          <div className="event-modal" onClick={(event) => event.stopPropagation()}>
            <div className="event-modal-header">
              <div>
                <h3>{selectedEvent.title}</h3>
                <p>
                  {selectedEvent.day} {selectedEvent.startTime.slice(0, 2)}:{selectedEvent.startTime.slice(2, 4)}
                  {' '}–{' '}
                  {selectedEvent.endTime.slice(0, 2)}:{selectedEvent.endTime.slice(2, 4)}
                </p>
              </div>
              <button className="event-modal-close" type="button" onClick={() => setSelectedEvent(null)}>
                Close
              </button>
            </div>

            <div className="event-modal-actions">
              <button className="event-modal-delete" type="button" onClick={handleDeleteSelectedEvent}>
                Delete event
              </button>
              <button className="event-modal-edit" type="button" onClick={() => {}}>
                Edit event (placeholder)
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <footer className="app-footer">
        <p>NUS Timetable App &copy; 2024 — Minimal Implementation</p>
      </footer>
    </div>
  );
}
