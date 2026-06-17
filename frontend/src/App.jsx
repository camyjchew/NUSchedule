import React, { useState, useEffect, useRef } from 'react';
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
  const [customEventDraft, setCustomEventDraft] = useState({
    title: '',
    day: 'Monday',
    startTime: '0900',
    endTime: '1000',
    color: '#60a5fa'
  });
  const [customEventFeedback, setCustomEventFeedback] = useState('');
  const [savingCustomEvent, setSavingCustomEvent] = useState(false);
  const [mergedSlots, setMergedSlots] = useState([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState('personal'); // 'personal' or 'group'
  const moduleSelectionsRef = useRef(moduleSelections);
  const customEventsRef = useRef(customEvents);

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

  const formatTimeForInput = (time) => {
    if (!time || time.length !== 4) {
      return '';
    }

    return `${time.slice(0, 2)}:${time.slice(2, 4)}`;
  };

  const dayOrder = {
    Monday: 0,
    Tuesday: 1,
    Wednesday: 2,
    Thursday: 3,
    Friday: 4
  };

  const timeToMinutes = (time) => {
    if (!time || time.length !== 4) {
      return 0;
    }

    const hours = Number(time.slice(0, 2));
    const minutes = Number(time.slice(2, 4));
    return hours * 60 + minutes;
  };

  const minutesToTime = (minutes) => {
    const safeMinutes = Math.max(0, Math.min(24 * 60 - 1, minutes));
    const hours = Math.floor(safeMinutes / 60)
      .toString()
      .padStart(2, '0');
    const mins = Math.round(safeMinutes % 60)
      .toString()
      .padStart(2, '0');
    return `${hours}${mins}`;
  };

  const sortCustomEvents = (events) => {
    return [...events].sort((left, right) => {
      const dayDiff = (dayOrder[left.day] ?? 99) - (dayOrder[right.day] ?? 99);
      if (dayDiff !== 0) {
        return dayDiff;
      }

      return timeToMinutes(left.startTime) - timeToMinutes(right.startTime);
    });
  };

  const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

  const updateCustomEvent = async (eventId, updates, options = {}) => {
    const { persist = false } = options;
    const previousEvents = customEventsRef.current;
    const nextEvents = sortCustomEvents(
      previousEvents.map((event) => (event.id === eventId ? { ...event, ...updates } : event))
    );

    customEventsRef.current = nextEvents;
    setCustomEvents(nextEvents);

    if (!persist) {
      return;
    }

    try {
      await saveTimetable(moduleSelectionsRef.current, nextEvents);
      setCustomEventFeedback('Custom event updated.');
    } catch (error) {
      console.error('Error updating custom event:', error);
      customEventsRef.current = previousEvents;
      setCustomEvents(previousEvents);
      setCustomEventFeedback('Could not save the event update. Please try again.');
    }
  };

  const editCustomEventTitle = async (eventId, title) => {
    await updateCustomEvent(eventId, { title: title.trim() }, { persist: true });
  };

  const saveTimetable = async (nextSelections, nextEvents) => {
    const response = await fetch(`/timetable/update?userId=${currentUserId}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        userId: currentUserId,
        moduleSelections: nextSelections,
        customEvents: nextEvents
      })
    });

    if (!response.ok) {
      throw new Error('Failed to save timetable');
    }
  };

  const updateCustomEventDraft = (field, value) => {
    setCustomEventDraft((current) => ({
      ...current,
      [field]: value
    }));
  };

  const handleAddCustomEvent = async (event) => {
    event.preventDefault();

    const title = customEventDraft.title.trim();
    if (!title) {
      setCustomEventFeedback('Add a title before saving the event.');
      return;
    }

    if (Number(customEventDraft.endTime) <= Number(customEventDraft.startTime)) {
      setCustomEventFeedback('End time must be later than start time.');
      return;
    }

    const newEvent = {
      id: window.crypto?.randomUUID?.() || `custom-${Date.now()}-${Math.random().toString(16).slice(2)}`,
      title,
      day: customEventDraft.day,
      startTime: customEventDraft.startTime,
      endTime: customEventDraft.endTime,
      color: customEventDraft.color
    };

    const nextEvents = sortCustomEvents([...customEventsRef.current, newEvent]);
    setSavingCustomEvent(true);
    setCustomEventFeedback('');
    customEventsRef.current = nextEvents;
    setCustomEvents(nextEvents);

    try {
      await saveTimetable(moduleSelectionsRef.current, nextEvents);
      setCustomEventDraft((current) => ({
        ...current,
        title: '',
        startTime: '0900',
        endTime: '1000'
      }));
      setCustomEventFeedback('Custom event saved.');
    } catch (error) {
      console.error('Error saving custom event:', error);
      customEventsRef.current = sortCustomEvents(customEventsRef.current.filter((item) => item.id !== newEvent.id));
      setCustomEvents(customEventsRef.current);
      setCustomEventFeedback('Could not save the event. Please try again.');
    } finally {
      setSavingCustomEvent(false);
    }
  };

  const handleDeleteCustomEvent = async (eventId) => {
    const previousEvents = customEventsRef.current;
    const nextEvents = previousEvents.filter((item) => item.id !== eventId);
    setSavingCustomEvent(true);
    setCustomEventFeedback('');
    customEventsRef.current = nextEvents;
    setCustomEvents(nextEvents);

    try {
      await saveTimetable(moduleSelectionsRef.current, nextEvents);
      setCustomEventFeedback('Custom event deleted.');
    } catch (error) {
      console.error('Error deleting custom event:', error);
      customEventsRef.current = previousEvents;
      setCustomEvents(previousEvents);
      setCustomEventFeedback('Could not delete the event. Please try again.');
    } finally {
      setSavingCustomEvent(false);
    }
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
        const sortedEvents = sortCustomEvents(normalizedEvents);
        setCustomEvents(sortedEvents);
        moduleSelectionsRef.current = normalizedSelections;
        customEventsRef.current = sortedEvents;

        // Merge slots
        const merged = mergeSlots(normalizedSelections, sortedEvents, nusmodsData);
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
              customEvents: sortedEvents
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
        const fallbackEvents = sortCustomEvents([
          {
            id: 'custom-1',
            title: 'Gym',
            day: 'Friday',
            startTime: '0800',
            endTime: '0900',
            color: '#34d399'
          }
        ]);
        setCustomEvents(fallbackEvents);
        customEventsRef.current = fallbackEvents;
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

  useEffect(() => {
    moduleSelectionsRef.current = moduleSelections;
  }, [moduleSelections]);

  useEffect(() => {
    customEventsRef.current = customEvents;
  }, [customEvents]);

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
            <form className="custom-event-panel" onSubmit={handleAddCustomEvent}>
              <div className="custom-event-panel-header">
                <div>
                  <h3>Add Custom Event</h3>
                  <p>Create a personal event and save it to your timetable.</p>
                </div>
                <button className="save-event-button" type="submit" disabled={savingCustomEvent}>
                  {savingCustomEvent ? 'Saving...' : 'Save event'}
                </button>
              </div>

              <div className="custom-event-fields">
                <label className="custom-event-field">
                  <span>Title</span>
                  <input
                    type="text"
                    value={customEventDraft.title}
                    onChange={(event) => updateCustomEventDraft('title', event.target.value)}
                    placeholder="Gym, CCA, meeting..."
                  />
                </label>

                <label className="custom-event-field">
                  <span>Day</span>
                  <select
                    value={customEventDraft.day}
                    onChange={(event) => updateCustomEventDraft('day', event.target.value)}
                  >
                    {['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'].map((day) => (
                      <option key={day} value={day}>
                        {day}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="custom-event-field">
                  <span>Start</span>
                  <input
                    type="time"
                    step="60"
                    value={formatTimeForInput(customEventDraft.startTime)}
                    onChange={(event) => updateCustomEventDraft('startTime', event.target.value.replace(':', ''))}
                  />
                </label>

                <label className="custom-event-field">
                  <span>End</span>
                  <input
                    type="time"
                    step="60"
                    value={formatTimeForInput(customEventDraft.endTime)}
                    onChange={(event) => updateCustomEventDraft('endTime', event.target.value.replace(':', ''))}
                  />
                </label>

                <label className="custom-event-field">
                  <span>Color</span>
                  <input
                    type="color"
                    value={customEventDraft.color}
                    onChange={(event) => updateCustomEventDraft('color', event.target.value)}
                  />
                </label>
              </div>

              <div className="custom-event-feedback" aria-live="polite">
                {customEventFeedback || 'Saved events will appear below and on the timetable.'}
              </div>

              {customEvents.length > 0 && (
                <div className="custom-event-list">
                  {customEvents.map((event) => (
                    <div key={event.id} className="custom-event-item">
                      <div className="custom-event-item-main">
                        <input
                          className="custom-event-title-input"
                          type="text"
                          defaultValue={event.title}
                          onBlur={(inputEvent) => {
                            const nextTitle = inputEvent.target.value.trim();
                            if (nextTitle && nextTitle !== event.title) {
                              editCustomEventTitle(event.id, nextTitle);
                            }
                          }}
                          onKeyDown={(inputEvent) => {
                            if (inputEvent.key === 'Enter') {
                              inputEvent.currentTarget.blur();
                            }
                          }}
                        />
                        <span>
                          {event.day} • {formatTimeForInput(event.startTime)} to {formatTimeForInput(event.endTime)}
                        </span>
                      </div>
                      <button
                        className="delete-event-button"
                        type="button"
                        onClick={() => handleDeleteCustomEvent(event.id)}
                        disabled={savingCustomEvent}
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </form>
            <TimetableGrid slots={mergedSlots} onCustomEventEdit={updateCustomEvent} />
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
