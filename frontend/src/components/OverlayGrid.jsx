import React, { useMemo, useState } from 'react';
import './OverlayGrid.css';

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];

export default function OverlayGrid({ overlaySlots }) {
  const [hoveredBlock, setHoveredBlock] = useState(null);
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });

  const blocksByDay = useMemo(() => {
    const grouped = new Map();
    DAYS.forEach((day) => grouped.set(day, []));

    overlaySlots.forEach((block) => {
      grouped.get(block.day).push(block);
    });

    return grouped;
  }, [overlaySlots]);

  const handleEnter = (event, block) => {
    if (!block || block.color === '#bbf7d0') {
      setHoveredBlock(null);
      return;
    }

    const rect = event.currentTarget.getBoundingClientRect();
    setTooltipPos({ x: rect.left + rect.width + 12, y: rect.top + 12 });
    setHoveredBlock(block);
  };

  return (
    <div className="overlay-grid-shell">
      <div className="overlay-grid-header">
        <div className="overlay-grid-corner" />
        {DAYS.map((day) => (
          <div key={day} className="overlay-grid-day-header">
            {day}
          </div>
        ))}
      </div>

      <div className="overlay-grid-body">
        {Array.from({ length: 28 }, (_, rowIndex) => {
          const startMinutes = 8 * 60 + rowIndex * 30;
          const label = `${String(Math.floor(startMinutes / 60)).padStart(2, '0')}:${String(startMinutes % 60).padStart(2, '0')}`;

          return (
            <React.Fragment key={label}>
              <div className="overlay-grid-time-label">{label}</div>
              {DAYS.map((day) => {
                const block = blocksByDay.get(day)?.[rowIndex];
                return (
                  <div
                    key={`${day}-${label}`}
                    className="overlay-grid-cell"
                    style={{ backgroundColor: block?.color || '#bbf7d0' }}
                    onMouseEnter={(event) => handleEnter(event, block)}
                    onMouseLeave={() => setHoveredBlock(null)}
                  />
                );
              })}
            </React.Fragment>
          );
        })}
      </div>

      {hoveredBlock && hoveredBlock.color !== '#bbf7d0' && (
        <div className="overlay-tooltip" style={{ left: tooltipPos.x, top: tooltipPos.y }}>
          <div className="overlay-tooltip-time">
            {hoveredBlock.day} {hoveredBlock.startTime.slice(0, 2)}:{hoveredBlock.startTime.slice(2, 4)}
            {' '}–{' '}
            {hoveredBlock.endTime.slice(0, 2)}:{hoveredBlock.endTime.slice(2, 4)}
          </div>
          <div className="overlay-tooltip-divider" />
          <div className="overlay-tooltip-list">
            {hoveredBlock.busyMembers.map((member) => (
              <div key={`${member.userId}-${member.reason}`} className="overlay-tooltip-item">
                <span className="overlay-tooltip-dot">🔴</span>
                <span>
                  <strong>{member.name}</strong> — {member.reason}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}