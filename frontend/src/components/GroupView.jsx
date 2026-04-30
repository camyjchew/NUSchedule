import React, { useState, useEffect } from 'react';
import SlotBlock from './SlotBlock';
import './GroupView.css';

export default function GroupView({ groupId, nusmodsData }) {
  const [groupData, setGroupData] = useState(null);
  const [activeMembers, setActiveMembers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Fetch group data
    const fetchGroup = async () => {
      try {
        const response = await fetch(`/group/${groupId}`);
        const data = await response.json();
        setGroupData(data);
        // Default: show all members
        setActiveMembers(data.members.map(m => m.userId));
      } catch (error) {
        console.error('Error fetching group:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchGroup();
  }, [groupId]);

  const mergeSlots = (member) => {
    const slots = [];

    // Add NUSMods module selections
    if (member.moduleSelections) {
      member.moduleSelections.forEach(selection => {
        const module = nusmodsData[selection.module_code];
        if (module) {
          const lessonSlot = module.semesterData[0].timetable.find(
            t =>
              t.lessonType === selection.lesson_type &&
              t.classNo === selection.class_no
          );
          if (lessonSlot) {
            slots.push({
              id: `${selection.module_code}-${selection.lesson_type}-${selection.class_no}`,
              title: `${selection.module_code} ${selection.lesson_type}`,
              day: lessonSlot.day,
              startTime: lessonSlot.startTime,
              endTime: lessonSlot.endTime,
              type: 'nusmods',
              venue: lessonSlot.venue,
              color: getColorForModule(selection.module_code),
              moduleCode: selection.module_code,
              lessonType: selection.lesson_type,
              classNo: selection.class_no
            });
          }
        }
      });
    }

    // Add custom events
    if (member.customEvents) {
      member.customEvents.forEach(event => {
        slots.push({
          id: event.id,
          title: event.title,
          day: event.day,
          startTime: event.start_time,
          endTime: event.end_time,
          type: 'custom',
          color: event.color
        });
      });
    }

    return slots;
  };

  const getColorForModule = (moduleCode) => {
    const colors = {
      CS2030S: '#6366f1',
      MA2001: '#ec4899',
      IS1108: '#f59e0b'
    };
    return colors[moduleCode] || '#60a5fa';
  };

  const toggleMember = (userId) => {
    setActiveMembers(prev =>
      prev.includes(userId)
        ? prev.filter(id => id !== userId)
        : [...prev, userId]
    );
  };

  if (loading) {
    return <div className="group-view-container">Loading group data...</div>;
  }

  if (!groupData) {
    return <div className="group-view-container">Group not found</div>;
  }

  // Get merged slots for active members
  const allSlots = [];
  groupData.members.forEach(member => {
    if (activeMembers.includes(member.userId)) {
      const slots = mergeSlots(member);
      slots.forEach(slot => {
        allSlots.push({
          ...slot,
          memberName: member.name,
          userId: member.userId
        });
      });
    }
  });

  // Group view uses TimetableGrid internally
  const TimetableGrid = ({ slots }) => {
    const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
    const START_HOUR = 8;
    const END_HOUR = 22;

    const timeToHours = (timeStr) => {
      const hours = parseInt(timeStr.slice(0, 2));
      const minutes = parseInt(timeStr.slice(2, 4));
      return hours + minutes / 60;
    };

    const getSlotMetrics = (slot) => {
      const startHours = timeToHours(slot.startTime);
      const endHours = timeToHours(slot.endTime);
      const totalHours = END_HOUR - START_HOUR;

      const topPercent = ((startHours - START_HOUR) / totalHours) * 100;
      const heightPercent = ((endHours - startHours) / totalHours) * 100;

      return { topPercent, heightPercent };
    };

    const slotsByDay = {};
    DAYS.forEach(day => {
      slotsByDay[day] = slots.filter(slot => slot.day === day);
    });

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

    const renderDayColumn = (day) => {
      return (
        <div key={day} className="day-column">
          <div className="day-header">{day}</div>
          <div className="day-content">
            {Array.from({ length: END_HOUR - START_HOUR }, (_, i) => (
              <div key={i} className="hour-slot"></div>
            ))}
            <div className="slots-container">
              {slotsByDay[day].map((slot, idx) => {
                const { topPercent, heightPercent } = getSlotMetrics(slot);
                return (
                  <SlotBlock
                    key={`${slot.id}-${slot.userId}`}
                    slot={slot}
                    topPercent={topPercent}
                    heightPercent={heightPercent}
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
  };

  return (
    <div className="group-view-container">
      <h2>{groupData.name}</h2>
      <div className="group-controls">
        <div className="member-toggles">
          {groupData.members.map(member => (
            <button
              key={member.userId}
              className={`member-toggle ${activeMembers.includes(member.userId) ? 'active' : ''}`}
              onClick={() => toggleMember(member.userId)}
            >
              {member.name}
            </button>
          ))}
        </div>
        <div className="member-count">
          Showing {activeMembers.length} of {groupData.members.length} members
        </div>
      </div>
      <TimetableGrid slots={allSlots} />
    </div>
  );
}
