const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
const START_MINUTES = 8 * 60;
const END_MINUTES = 22 * 60;
const BLOCK_MINUTES = 30;

const COLOR_GREEN = '#bbf7d0';
const COLOR_YELLOW = '#fef9c3';
const COLOR_ORANGE = '#fed7aa';
const COLOR_RED = '#fecaca';

const timeToMinutes = (value) => {
  const hours = Number.parseInt(value.slice(0, 2), 10);
  const minutes = Number.parseInt(value.slice(2, 4), 10);
  return hours * 60 + minutes;
};

const minutesToTime = (minutes) => {
  const hours = String(Math.floor(minutes / 60)).padStart(2, '0');
  const mins = String(minutes % 60).padStart(2, '0');
  return `${hours}${mins}`;
};

const getModuleColor = (moduleCode) => {
  const colors = {
    CS2030S: '#6366f1',
    MA2001: '#ec4899',
    IS1108: '#f59e0b'
  };
  return colors[moduleCode] || '#60a5fa';
};

const getMemberSlots = (member, nusmodsData) => {
  const slots = [];

  member.moduleSelections?.forEach((selection) => {
    const moduleData = nusmodsData[selection.moduleCode || selection.module_code];
    if (!moduleData) {
      return;
    }

    const lessonType = selection.lessonType || selection.lesson_type;
    const classNo = selection.classNo || selection.class_no;
    const lesson = moduleData.semesterData[0].timetable.find(
      (entry) => entry.lessonType === lessonType && entry.classNo === classNo
    );

    if (lesson) {
      const moduleCode = selection.moduleCode || selection.module_code;
      slots.push({
        day: lesson.day,
        startTime: lesson.startTime,
        endTime: lesson.endTime,
        reason: `${moduleData.title} ${lesson.lessonType}`,
        moduleCode,
        lessonType: lesson.lessonType,
        classNo: lesson.classNo,
        color: getModuleColor(moduleCode)
      });
    }
  });

  member.customEvents?.forEach((event) => {
    slots.push({
      day: event.day,
      startTime: event.startTime || event.start_time,
      endTime: event.endTime || event.end_time,
      reason: event.title,
      moduleCode: null,
      lessonType: null,
      classNo: null,
      color: event.color || '#60a5fa'
    });
  });

  return slots;
};

const getOverlayColor = (busyCount, activeCount) => {
  if (busyCount === 0) {
    return COLOR_GREEN;
  }

  if (activeCount <= 1) {
    return COLOR_YELLOW;
  }

  const yellowMax = Math.max(1, Math.floor(activeCount / 3));
  const orangeMax = Math.max(yellowMax, Math.floor((activeCount * 2) / 3));

  if (busyCount <= yellowMax) {
    return COLOR_YELLOW;
  }

  if (busyCount <= orangeMax) {
    return COLOR_ORANGE;
  }

  return COLOR_RED;
};

const overlaps = (slot, block) => {
  return slot.day === block.day && slot.startTime < block.endTime && slot.endTime > block.startTime;
};

export default function computeOverlay(members, activeMembers, nusmodsData) {
  const activeMemberSet = new Set(activeMembers);
  const memberSlotMap = new Map();

  members.forEach((member) => {
    if (!activeMemberSet.has(member.userId)) {
      return;
    }

    memberSlotMap.set(member.userId, getMemberSlots(member, nusmodsData));
  });

  const overlaySlots = [];

  for (const day of DAYS) {
    for (let minutes = START_MINUTES; minutes < END_MINUTES; minutes += BLOCK_MINUTES) {
      const block = {
        day,
        startTime: minutesToTime(minutes),
        endTime: minutesToTime(minutes + BLOCK_MINUTES)
      };

      const busyMembers = [];

      members.forEach((member) => {
        if (!activeMemberSet.has(member.userId)) {
          return;
        }

        const slot = memberSlotMap.get(member.userId)?.find((entry) => overlaps(entry, block));
        if (slot) {
          busyMembers.push({
            userId: member.userId,
            name: member.name,
            reason: slot.reason
          });
        }
      });

      overlaySlots.push({
        ...block,
        busyMembers,
        color: getOverlayColor(busyMembers.length, activeMembers.length)
      });
    }
  }

  return overlaySlots;
}