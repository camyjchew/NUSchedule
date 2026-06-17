import React, { useEffect, useRef, useState } from 'react';
import React, { useEffect, useRef } from 'react';
import './SlotBlock.css';

const TIMETABLE_START_MINUTES = 8 * 60;
const TIMETABLE_END_MINUTES = 22 * 60;
const MIN_DURATION_MINUTES = 15;
const SNAP_MINUTES = 15;

const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

const minutesToTime = (minutes) => {
  const safeMinutes = clamp(minutes, TIMETABLE_START_MINUTES, TIMETABLE_END_MINUTES);
  const hours = Math.floor(safeMinutes / 60)
    .toString()
    .padStart(2, '0');
  const mins = Math.round(safeMinutes % 60)
    .toString()
    .padStart(2, '0');
  return `${hours}${mins}`;
};

const timeToMinutes = (time) => {
  const hours = Number(time.slice(0, 2));
  const minutes = Number(time.slice(2, 4));
  return hours * 60 + minutes;
};

const snapMinutes = (minutes) => Math.round(minutes / SNAP_MINUTES) * SNAP_MINUTES;

const hexToRgba = (hex, alpha) => {
  if (!hex || typeof hex !== 'string') {
    return `rgba(96, 165, 250, ${alpha})`;
  }

  const normalized = hex.replace('#', '');
  if (normalized.length !== 6) {
    return hex;
  }

  const red = Number.parseInt(normalized.slice(0, 2), 16);
  const green = Number.parseInt(normalized.slice(2, 4), 16);
  const blue = Number.parseInt(normalized.slice(4, 6), 16);

  if ([red, green, blue].some(Number.isNaN)) {
    return hex;
  }

  return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
};

const getDayColumn = (clientX, clientY, fallbackDay) => {
  const element = document.elementFromPoint(clientX, clientY);
  const dayColumn = element?.closest?.('.day-column[data-day]');

  if (dayColumn) {
    return dayColumn;
  }

  if (!fallbackDay) {
    return null;
  }

  return document.querySelector(`.day-column[data-day="${fallbackDay}"]`);
};

const getDayContent = (clientX, clientY, fallbackDay) => {
  const dayColumn = getDayColumn(clientX, clientY, fallbackDay);
  return dayColumn?.querySelector('.day-content') || null;
};

export default function SlotBlock({ slot, topPercent, heightPercent, onCustomEventEdit }) {
  const isCustomEvent = slot.type === 'custom';
  const borderStyle = !isCustomEvent ? '2px dashed' : 'none';
  const slotRef = useRef(slot);
  const titleInputRef = useRef(null);
  const interactionRef = useRef(null);
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [draftTitle, setDraftTitle] = useState(slot.title);
  const interactionRef = useRef(null);

  useEffect(() => {
    slotRef.current = slot;
  }, [slot]);

  useEffect(() => {
    if (!isEditingTitle) {
      setDraftTitle(slot.title);
    }
  }, [slot.title, isEditingTitle]);

  useEffect(() => {
    if (isEditingTitle) {
      titleInputRef.current?.focus();
      titleInputRef.current?.select();
    }
  }, [isEditingTitle]);

  useEffect(() => {
    return () => {
      document.removeEventListener('pointermove', handlePointerMove);
      document.removeEventListener('pointerup', finishInteraction);
      document.removeEventListener('pointercancel', finishInteraction);
      document.body.classList.remove('slot-dragging');
    };
  }, []);

  const stopInteraction = () => {
    interactionRef.current = null;
    document.body.classList.remove('slot-dragging');
    document.removeEventListener('pointermove', handlePointerMove);
    document.removeEventListener('pointerup', finishInteraction);
    document.removeEventListener('pointercancel', finishInteraction);
  };

  const commitEdit = (nextSlot, persist) => {
    if (!onCustomEventEdit || !isCustomEvent) {
      return;
    }

    interactionRef.current = {
      ...interactionRef.current,
      lastUpdate: nextSlot
    };

    onCustomEventEdit(
      slot.id,
      {
        title: slotRef.current.title,
        day: nextSlot.day,
        startTime: nextSlot.startTime,
        endTime: nextSlot.endTime
      },
      { persist }
    );
  };

  function handlePointerMove(pointerEvent) {
    const interaction = interactionRef.current;
    if (!interaction) {
      return;
    }

    pointerEvent.preventDefault();

    const currentSlot = slotRef.current;
    const dayContent = getDayContent(pointerEvent.clientX, pointerEvent.clientY, currentSlot.day);
    if (!dayContent) {
      return;
    }

    const rect = dayContent.getBoundingClientRect();
    const totalMinutes = TIMETABLE_END_MINUTES - TIMETABLE_START_MINUTES;
    const currentStartMinutes = timeToMinutes(currentSlot.startTime);
    const currentEndMinutes = timeToMinutes(currentSlot.endTime);
    const currentDuration = currentEndMinutes - currentStartMinutes;
    const currentDay = dayContent.parentElement?.dataset.day || currentSlot.day;

    if (interaction.mode === 'move') {
      const rawTopPx = pointerEvent.clientY - rect.top - interaction.offsetY;
      const maxTopPx = rect.height - ((currentDuration / totalMinutes) * rect.height);
      const clampedTopPx = clamp(rawTopPx, 0, Math.max(0, maxTopPx));
      const minutesFromTop = (clampedTopPx / rect.height) * totalMinutes;
      const snappedStart = snapMinutes(TIMETABLE_START_MINUTES + minutesFromTop);
      const startMinutes = clamp(snappedStart, TIMETABLE_START_MINUTES, TIMETABLE_END_MINUTES - currentDuration);
      const endMinutes = startMinutes + currentDuration;

      commitEdit(
        {
          day: currentDay,
          startTime: minutesToTime(startMinutes),
          endTime: minutesToTime(endMinutes)
        },
        false
      );
      return;
    }

    if (interaction.mode === 'resize-top') {
      const minutesFromTop = ((pointerEvent.clientY - rect.top) / rect.height) * totalMinutes;
      const snappedStart = snapMinutes(TIMETABLE_START_MINUTES + minutesFromTop);
      const startMinutes = clamp(snappedStart, TIMETABLE_START_MINUTES, currentEndMinutes - MIN_DURATION_MINUTES);

      commitEdit(
        {
          day: currentDay,
          startTime: minutesToTime(startMinutes),
          endTime: minutesToTime(currentEndMinutes)
        },
        false
      );
      return;
    }

    if (interaction.mode === 'resize-bottom') {
      const minutesFromTop = ((pointerEvent.clientY - rect.top) / rect.height) * totalMinutes;
      const snappedEnd = snapMinutes(TIMETABLE_START_MINUTES + minutesFromTop);
      const endMinutes = clamp(snappedEnd, currentStartMinutes + MIN_DURATION_MINUTES, TIMETABLE_END_MINUTES);

      commitEdit(
        {
          day: currentDay,
          startTime: minutesToTime(currentStartMinutes),
          endTime: minutesToTime(endMinutes)
        },
        false
      );
    }
  }

  function finishInteraction() {
    const interaction = interactionRef.current;
    if (!interaction) {
      return;
    }

    const finalSlot = interaction.lastUpdate || slotRef.current;
    stopInteraction();

    if (interaction.mode === 'move' || interaction.mode === 'resize-top' || interaction.mode === 'resize-bottom') {
      commitEdit(
        {
          day: finalSlot.day,
          startTime: finalSlot.startTime,
          endTime: finalSlot.endTime
        },
        true
      );
    }
  }

  const beginInteraction = (mode, pointerEvent) => {
    if (!isCustomEvent || !onCustomEventEdit) {
      return;
    }

    pointerEvent.preventDefault();
    pointerEvent.stopPropagation();

    interactionRef.current = {
      mode,
      offsetY: pointerEvent.nativeEvent.offsetY ?? 0
    };

    document.body.classList.add('slot-dragging');
    document.addEventListener('pointermove', handlePointerMove);
    document.addEventListener('pointerup', finishInteraction, { once: true });
    document.addEventListener('pointercancel', finishInteraction, { once: true });
  };

  const beginTitleEdit = (event) => {
    if (!isCustomEvent || !onCustomEventEdit) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    setDraftTitle(slotRef.current.title);
    setIsEditingTitle(true);
  };

  const saveTitleEdit = () => {
    if (!isCustomEvent || !onCustomEventEdit) {
      setIsEditingTitle(false);
      return;
    }

    const nextTitle = draftTitle.trim();
    const currentTitle = slotRef.current.title.trim();

    if (!nextTitle) {
      setDraftTitle(slotRef.current.title);
      setIsEditingTitle(false);
      return;
    }

    setIsEditingTitle(false);

    if (nextTitle !== currentTitle) {
      onCustomEventEdit(slot.id, { title: nextTitle }, { persist: true });
    }
  };

  const cancelTitleEdit = () => {
    setDraftTitle(slotRef.current.title);
    setIsEditingTitle(false);
  };

  return (
    <div
      className={`slot-block ${isCustomEvent ? 'custom-slot' : ''} ${isEditingTitle ? 'editing-title' : ''}`}
      style={{
        top: `${topPercent}%`,
        height: `${heightPercent}%`,
        backgroundColor: isCustomEvent ? hexToRgba(slot.color, 0.18) : slot.color,
        border: isCustomEvent ? `2px solid ${slot.color}` : borderStyle + ` ${slot.color}`,
        borderRadius: '6px',
        padding: '5px 6px',
        fontSize: '11px',
        fontWeight: '500',
        color: isCustomEvent ? '#0f172a' : '#fff',
        overflow: 'hidden',
        cursor: isCustomEvent ? 'grab' : 'default',
        boxShadow: isCustomEvent ? `0 0 0 1px rgba(15, 23, 42, 0.06), inset 0 0 0 1px ${hexToRgba(slot.color, 0.24)}` : '0 1px 3px rgba(0, 0, 0, 0.1)',

  return (
    <div
      className={`slot-block ${isCustomEvent ? 'custom-slot' : ''}`}
      style={{
        top: `${topPercent}%`,
        height: `${heightPercent}%`,
        backgroundColor: isCustomEvent ? 'transparent' : slot.color,
        border: borderStyle + ` ${slot.color}`,
        borderRadius: '4px',
        padding: '4px',
        fontSize: '11px',
        fontWeight: '500',
        color: isCustomEvent ? '#374151' : '#fff',
        overflow: 'hidden',
        cursor: isCustomEvent ? 'grab' : 'default',
        transition: 'all 0.2s',
      }}
      title={`${slot.title} (${slot.startTime}-${slot.endTime})${slot.venue ? ' @ ' + slot.venue : ''}`}
      onPointerDown={(pointerEvent) => beginInteraction('move', pointerEvent)}
    >
      <div className="slot-block-content">
        {isCustomEvent && isEditingTitle ? (
          <input
            ref={titleInputRef}
            className="slot-block-title-input"
            type="text"
            value={draftTitle}
            onChange={(changeEvent) => setDraftTitle(changeEvent.target.value)}
            onBlur={saveTitleEdit}
            onKeyDown={(keyEvent) => {
              if (keyEvent.key === 'Enter') {
                keyEvent.preventDefault();
                saveTitleEdit();
              }

              if (keyEvent.key === 'Escape') {
                keyEvent.preventDefault();
                cancelTitleEdit();
              }
            }}
            onPointerDown={(pointerEvent) => pointerEvent.stopPropagation()}
          />
        ) : (
          <div
            className={`slot-block-title ${isCustomEvent ? 'slot-block-title-editable' : ''}`}
            onDoubleClick={beginTitleEdit}
            onPointerDown={(pointerEvent) => {
              if (isCustomEvent) {
                pointerEvent.stopPropagation();
              }
            }}
            title={isCustomEvent ? 'Double click to edit the title' : undefined}
          >
            {slot.title}
          </div>
        )}
        {isCustomEvent && !isEditingTitle && (
          <div className="slot-block-time">
            {slot.startTime.slice(0, 2)}:{slot.startTime.slice(2, 4)} - {slot.endTime.slice(0, 2)}:{slot.endTime.slice(2, 4)}
          </div>
        )}
        <div className="slot-block-title">{slot.title}</div>
        {slot.venue && <div className="slot-block-venue">{slot.venue}</div>}
      </div>
      {isCustomEvent && (
        <>
          <div
            className="slot-block-handle slot-block-handle-top"
            onPointerDown={(pointerEvent) => {
              pointerEvent.stopPropagation();
              beginInteraction('resize-top', pointerEvent);
            }}
          />
          <div
            className="slot-block-handle slot-block-handle-bottom"
            onPointerDown={(pointerEvent) => {
              pointerEvent.stopPropagation();
              beginInteraction('resize-bottom', pointerEvent);
            }}
          />
        </>
      )}
    </div>
  );
}
