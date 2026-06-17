import React from 'react';
import SlotBlock from './SlotBlock';
import './TimetableGrid.css';

export default function TimetableGrid({ slots, onCustomEventEdit }) {
  const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
  const START_HOUR = 8;
  const END_HOUR = 22;

  // Helper function to convert time string (HHMM) to decimal hours
  const timeToHours = (timeStr) => {
    const hours = parseInt(timeStr.slice(0, 2));
    const minutes = parseInt(timeStr.slice(2, 4));
    return hours + minutes / 60;
  };

  // Helper function to calculate position and height of a slot
  const getSlotMetrics = (slot) => {
    const startHours = timeToHours(slot.startTime);
    const endHours = timeToHours(slot.endTime);
    const totalHours = END_HOUR - START_HOUR;

    const topPercent = ((startHours - START_HOUR) / totalHours) * 100;
    const heightPercent = ((endHours - startHours) / totalHours) * 100;

    return { topPercent, heightPercent };
  };

  // Group slots by day
  const slotsByDay = {};
  DAYS.forEach(day => {
    slotsByDay[day] = slots.filter(slot => slot.day === day);
  });

  // Helper to render time column
  const renderTimeColumn = () => {
    const hours = [];
    for (let h = START_HOUR; h <= END_HOUR; h++) {
      hours.push(
        <div key={h} className="time-slot" style={{ height: `${100 / (END_HOUR - START_HOUR)}%` }}>
          <div className="time-label">{h.toString().padStart(2, '0')}:00</div>
        </div>
      );
    }
    return <div className="time-column">{hours}</div>;
  };

  // Helper to render day column
  const renderDayColumn = (day) => {
    return (
      <div key={day} className="day-column" data-day={day}>
        <div className="day-header">{day}</div>
        <div className="day-content">
          {Array.from({ length: END_HOUR - START_HOUR }, (_, i) => (
            <div key={i} className="hour-slot"></div>
          ))}
          <div className="slots-container">
            {slotsByDay[day].map(slot => {
              const { topPercent, heightPercent } = getSlotMetrics(slot);
              return (
                <SlotBlock
                  key={slot.id}
                  slot={slot}
                  topPercent={topPercent}
                  heightPercent={heightPercent}
                  onCustomEventEdit={onCustomEventEdit}
                />
              );
            })}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="timetable-grid-container">
      {renderTimeColumn()}
      {DAYS.map(day => renderDayColumn(day))}
    </div>
  );
}
