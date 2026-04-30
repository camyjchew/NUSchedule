import React from 'react';
import './SlotBlock.css';

export default function SlotBlock({ slot, topPercent, heightPercent }) {
  const isBogey = slot.type === 'nusmods';
  const borderStyle = !isBogey ? '2px dashed' : 'none';

  return (
    <div
      className="slot-block"
      style={{
        top: `${topPercent}%`,
        height: `${heightPercent}%`,
        backgroundColor: isBogey ? slot.color : 'transparent',
        border: borderStyle + ` ${slot.color}`,
        borderRadius: '4px',
        padding: '4px',
        fontSize: '11px',
        fontWeight: '500',
        color: isBogey ? '#fff' : '#374151',
        overflow: 'hidden',
        cursor: 'pointer',
        transition: 'all 0.2s',
      }}
      title={`${slot.title} (${slot.startTime}-${slot.endTime})${slot.venue ? ' @ ' + slot.venue : ''}`}
    >
      <div>{slot.title}</div>
      {slot.venue && <div style={{ fontSize: '10px', opacity: 0.8 }}>{slot.venue}</div>}
    </div>
  );
}
