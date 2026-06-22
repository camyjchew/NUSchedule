import React, { useState, useEffect, useRef, useMemo } from 'react';
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
  const [currentUser, setCurrentUser] = useState(null);
  const [loginNotice, setLoginNotice] = useState('');
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [eventEditDraft, setEventEditDraft] = useState(null);
  const [slotOverrides, setSlotOverrides] = useState([]);
  const [selectedModuleSlot, setSelectedModuleSlot] = useState(null);
  const [moduleSlotEditDraft, setModuleSlotEditDraft] = useState(null);
  const moduleSelectionsRef = useRef(moduleSelections);
  const customEventsRef = useRef(customEvents);
  const slotOverridesRef = useRef(slotOverrides);

  // Helper function to get color for a module
  const getColorForModule = (moduleCode) => {
    const colors = {
      CS2030S: '#6366f1',
      MA2001: '#ec4899',
      IS1108: '#f59e0b'
    };
    return colors[moduleCode] || '#60a5fa';
  };

  // Identity key for a NUSMods lesson slot, used to attach overrides to it.
  const overrideKey = (moduleCode, lessonType, classNo) => `${moduleCode}-${lessonType}-${classNo}`;

  // Pure function to merge slots from module selections, custom events, and
  // per-slot overrides (color/label edits layered on top of the NUSMods data).
  const mergeSlots = (selections, events, modulesData, overrides) => {
    const slots = [];
    const overrideMap = new Map(
      (overrides || []).map((o) => [overrideKey(o.moduleCode, o.lessonType, o.classNo), o])
    );

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
          const key = overrideKey(moduleCode, lessonType, classNo);
          const override = overrideMap.get(key);

          slots.push({
            id: key,
            title: override?.label || `${moduleCode} ${lessonType}`,
            day: lessonSlot.day,
            startTime: lessonSlot.startTime,
            endTime: lessonSlot.endTime,
            type: 'nusmods',
            venue: lessonSlot.venue,
            color: override?.color || getColorForModule(moduleCode),
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

  const saveTimetable = async (nextSelections, nextEvents, nextOverrides) => {
    const response = await fetch(`/timetable/update?userId=${currentUserId}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        userId: currentUserId,
        moduleSelections: nextSelections,
        customEvents: nextEvents,
        slotOverrides: nextOverrides ?? slotOverridesRef.current
      })
    });

    if (!response.ok) {
      throw new Error('Failed to save timetable');
    }
  };

  const upsertSlotOverride = async (moduleCode, lessonType, classNo, updates, options = {}) => {
    const { persist = false } = options;
    const key = overrideKey(moduleCode, lessonType, classNo);
    const previousOverrides = slotOverridesRef.current;
    const existing = previousOverrides.find(
      (o) => overrideKey(o.moduleCode, o.lessonType, o.classNo) === key
    );
    const nextOverride = {
      moduleCode,
      lessonType,
      classNo,
      color: existing?.color,
      label: existing?.label,
      ...updates
    };
    const nextOverrides = [
      ...previousOverrides.filter((o) => overrideKey(o.moduleCode, o.lessonType, o.classNo) !== key),
      nextOverride
    ];

    slotOverridesRef.current = nextOverrides;
    setSlotOverrides(nextOverrides);

    if (!persist) {
      return;
    }

    try {
      await saveTimetable(moduleSelectionsRef.current, customEventsRef.current, nextOverrides);
      setCustomEventFeedback('Class style updated.');
    } catch (error) {
      console.error('Error saving slot override:', error);
      slotOverridesRef.current = previousOverrides;
      setSlotOverrides(previousOverrides);
      setCustomEventFeedback('Could not save the change. Please try again.');
    }
  };

  const resetSlotOverride = async (moduleCode, lessonType, classNo) => {
    const key = overrideKey(moduleCode, lessonType, classNo);
    const previousOverrides = slotOverridesRef.current;
    const nextOverrides = previousOverrides.filter(
      (o) => overrideKey(o.moduleCode, o.lessonType, o.classNo) !== key
    );

    slotOverridesRef.current = nextOverrides;
    setSlotOverrides(nextOverrides);

    try {
      await saveTimetable(moduleSelectionsRef.current, customEventsRef.current, nextOverrides);
      setCustomEventFeedback('Reset to NUSMods default.');
    } catch (error) {
      console.error('Error resetting slot override:', error);
      slotOverridesRef.current = previousOverrides;
      setSlotOverrides(previousOverrides);
      setCustomEventFeedback('Could not reset the change. Please try again.');
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
        const fetchedOverrides = data.slotOverrides || [];

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
        setSlotOverrides(fetchedOverrides);
        moduleSelectionsRef.current = normalizedSelections;
        customEventsRef.current = sortedEvents;
        slotOverridesRef.current = fetchedOverrides;

        // Merge slots
        const merged = mergeSlots(normalizedSelections, sortedEvents, nusmodsData, fetchedOverrides);
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

  // Re-merge slots whenever selections, events, or overrides change
  useEffect(() => {
    const merged = mergeSlots(moduleSelections, customEvents, nusmodsData, slotOverrides);
    setMergedSlots(merged);
  }, [moduleSelections, customEvents, nusmodsData, slotOverrides]);

  useEffect(() => {
    moduleSelectionsRef.current = moduleSelections;
  }, [moduleSelections]);

  useEffect(() => {
    customEventsRef.current = customEvents;
  }, [customEvents]);

  useEffect(() => {
    slotOverridesRef.current = slotOverrides;
  }, [slotOverrides]);

  // Overrides whose (moduleCode, lessonType, classNo) no longer matches a
  // currently selected lesson — e.g. after a fresh NUSMods import changed
  // class numbers. The override is kept (not deleted), but won't visibly
  // apply until that exact slot is selected again, so we warn about it.
  const orphanedOverrides = useMemo(() => {
    const validKeys = new Set(
      moduleSelections.map((s) =>
        overrideKey(s.moduleCode || s.module_code, s.lessonType || s.lesson_type, s.classNo || s.class_no)
      )
    );

    return slotOverrides.filter(
      (o) => !validKeys.has(overrideKey(o.moduleCode, o.lessonType, o.classNo))
    );
  }, [slotOverrides, moduleSelections]);

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

    window.localStorage.setItem('currentUserId', String(userId));
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

  const handleCustomEventClick = (slot) => {
    setSelectedEvent(slot);
    setEventEditDraft({
      title: slot.title,
      day: slot.day,
      startTime: slot.startTime,
      endTime: slot.endTime,
      color: slot.color
    });
  };

  const closeEventModal = () => {
    setSelectedEvent(null);
    setEventEditDraft(null);
  };

  const updateEventEditDraft = (field, value) => {
    setEventEditDraft((current) => ({ ...current, [field]: value }));
  };

  const handleSaveSelectedEvent = async () => {
    if (!selectedEvent || !eventEditDraft) {
      return;
    }

    const title = eventEditDraft.title.trim();
    if (!title) {
      setCustomEventFeedback('Add a title before saving.');
      return;
    }

    if (Number(eventEditDraft.endTime) <= Number(eventEditDraft.startTime)) {
      setCustomEventFeedback('End time must be later than start time.');
      return;
    }

    await updateCustomEvent(
      selectedEvent.id,
      {
        title,
        day: eventEditDraft.day,
        startTime: eventEditDraft.startTime,
        endTime: eventEditDraft.endTime,
        color: eventEditDraft.color
      },
      { persist: true }
    );
    closeEventModal();
  };

  const handleDeleteSelectedEvent = async () => {
    if (!selectedEvent) {
      return;
    }

    await handleDeleteCustomEvent(selectedEvent.id);
    closeEventModal();
  };

  const handleModuleSlotClick = (slot) => {
    setSelectedModuleSlot(slot);
    setModuleSlotEditDraft({ label: slot.title, color: slot.color });
  };

  const closeModuleSlotModal = () => {
    setSelectedModuleSlot(null);
    setModuleSlotEditDraft(null);
  };

  const updateModuleSlotDraft = (field, value) => {
    setModuleSlotEditDraft((current) => ({ ...current, [field]: value }));
  };

  const handleSaveModuleSlotOverride = async () => {
    if (!selectedModuleSlot || !moduleSlotEditDraft) {
      return;
    }

    const label = moduleSlotEditDraft.label.trim();
    await upsertSlotOverride(
      selectedModuleSlot.moduleCode,
      selectedModuleSlot.lessonType,
      selectedModuleSlot.classNo,
      { label: label || null, color: moduleSlotEditDraft.color },
      { persist: true }
    );
    closeModuleSlotModal();
  };

  const handleResetModuleSlotOverride = async () => {
    if (!selectedModuleSlot) {
      return;
    }

    await resetSlotOverride(
      selectedModuleSlot.moduleCode,
      selectedModuleSlot.lessonType,
      selectedModuleSlot.classNo
    );
    closeModuleSlotModal();
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
            {orphanedOverrides.length > 0 && (
              <div className="override-warning-banner">
                {orphanedOverrides.length} class customization{orphanedOverrides.length > 1 ? 's' : ''} no
                longer match your current schedule (the class slot may have changed). They were kept and
                will reapply automatically if you select that exact class again.
              </div>
            )}
            <TimetableGrid
              slots={mergedSlots}
              onCustomEventEdit={updateCustomEvent}
              onCustomEventClick={handleCustomEventClick}
              onModuleSlotClick={handleModuleSlotClick}
            />
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

      {selectedEvent && eventEditDraft ? (
        <div className="event-modal-backdrop" onClick={closeEventModal}>
          <div className="event-modal" onClick={(event) => event.stopPropagation()}>
            <div className="event-modal-header">
              <div>
                <h3>Edit event</h3>
                <p>Update the details below, then save.</p>
              </div>
              <button className="event-modal-close" type="button" onClick={closeEventModal}>
                Close
              </button>
            </div>

            <div className="custom-event-fields">
              <label className="custom-event-field">
                <span>Title</span>
                <input
                  type="text"
                  value={eventEditDraft.title}
                  onChange={(event) => updateEventEditDraft('title', event.target.value)}
                />
              </label>

              <label className="custom-event-field">
                <span>Day</span>
                <select
                  value={eventEditDraft.day}
                  onChange={(event) => updateEventEditDraft('day', event.target.value)}
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
                  value={formatTimeForInput(eventEditDraft.startTime)}
                  onChange={(event) => updateEventEditDraft('startTime', event.target.value.replace(':', ''))}
                />
              </label>

              <label className="custom-event-field">
                <span>End</span>
                <input
                  type="time"
                  step="60"
                  value={formatTimeForInput(eventEditDraft.endTime)}
                  onChange={(event) => updateEventEditDraft('endTime', event.target.value.replace(':', ''))}
                />
              </label>

              <label className="custom-event-field">
                <span>Color</span>
                <input
                  type="color"
                  value={eventEditDraft.color}
                  onChange={(event) => updateEventEditDraft('color', event.target.value)}
                />
              </label>
            </div>

            <div className="event-modal-actions">
              <button className="event-modal-delete" type="button" onClick={handleDeleteSelectedEvent}>
                Delete event
              </button>
              <button className="event-modal-edit" type="button" onClick={handleSaveSelectedEvent}>
                Save changes
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {selectedModuleSlot && moduleSlotEditDraft ? (
        <div className="event-modal-backdrop" onClick={closeModuleSlotModal}>
          <div className="event-modal" onClick={(event) => event.stopPropagation()}>
            <div className="event-modal-header">
              <div>
                <h3>Customize class</h3>
                <p>
                  {selectedModuleSlot.moduleCode} {selectedModuleSlot.lessonType} — {selectedModuleSlot.day}{' '}
                  {formatTimeForInput(selectedModuleSlot.startTime)} to {formatTimeForInput(selectedModuleSlot.endTime)}
                </p>
              </div>
              <button className="event-modal-close" type="button" onClick={closeModuleSlotModal}>
                Close
              </button>
            </div>

            <div className="custom-event-fields">
              <label className="custom-event-field">
                <span>Display label</span>
                <input
                  type="text"
                  value={moduleSlotEditDraft.label}
                  onChange={(event) => updateModuleSlotDraft('label', event.target.value)}
                  placeholder={`${selectedModuleSlot.moduleCode} ${selectedModuleSlot.lessonType}`}
                />
              </label>

              <label className="custom-event-field">
                <span>Color</span>
                <input
                  type="color"
                  value={moduleSlotEditDraft.color}
                  onChange={(event) => updateModuleSlotDraft('color', event.target.value)}
                />
              </label>
            </div>

            <p className="custom-event-feedback">
              This only changes how the class looks for you. Day, time, and venue stay tied to NUSMods data.
            </p>

            <div className="event-modal-actions">
              <button className="event-modal-delete" type="button" onClick={handleResetModuleSlotOverride}>
                Reset to default
              </button>
              <button className="event-modal-edit" type="button" onClick={handleSaveModuleSlotOverride}>
                Save changes
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
