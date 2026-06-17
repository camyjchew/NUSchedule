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
  const interactionRef = useRef(null);

  useEffect(() => {
    slotRef.current = slot;
  }, [slot]);

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
