// Mock NUSMods API data for 3 modules
// Each module contains semester data with full timetable information
export const NUSMODS_MODULE_DATA = {
  CS2030S: {
    moduleCode: "CS2030S",
    title: "Programming Methodology II",
    moduleCredit: "4",
    semesterData: [
      {
        semester: 1,
        timetable: [
          {
            classNo: "1",
            lessonType: "Lecture",
            day: "Monday",
            startTime: "1400",
            endTime: "1600",
            venue: "LT27",
            weeks: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13]
          },
          {
            classNo: "2",
            lessonType: "Lecture",
            day: "Tuesday",
            startTime: "1400",
            endTime: "1600",
            venue: "LT26",
            weeks: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13]
          },
          {
            classNo: "04",
            lessonType: "Tutorial",
            day: "Wednesday",
            startTime: "1000",
            endTime: "1100",
            venue: "COM1-0113",
            weeks: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13]
          },
          {
            classNo: "05",
            lessonType: "Tutorial",
            day: "Thursday",
            startTime: "1000",
            endTime: "1100",
            venue: "COM1-0114",
            weeks: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13]
          }
        ]
      }
    ]
  },
  MA2001: {
    moduleCode: "MA2001",
    title: "Linear Algebra I",
    moduleCredit: "4",
    semesterData: [
      {
        semester: 1,
        timetable: [
          {
            classNo: "1",
            lessonType: "Lecture",
            day: "Tuesday",
            startTime: "1000",
            endTime: "1200",
            venue: "S11-LT6",
            weeks: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13]
          },
          {
            classNo: "01",
            lessonType: "Tutorial",
            day: "Thursday",
            startTime: "1400",
            endTime: "1500",
            venue: "S12-0302",
            weeks: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13]
          },
          {
            classNo: "02",
            lessonType: "Tutorial",
            day: "Friday",
            startTime: "1000",
            endTime: "1100",
            venue: "S12-0303",
            weeks: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13]
          }
        ]
      }
    ]
  },
  IS1108: {
    moduleCode: "IS1108",
    title: "Digital Ethics and Data Governance",
    moduleCredit: "4",
    semesterData: [
      {
        semester: 1,
        timetable: [
          {
            classNo: "1",
            lessonType: "Lecture",
            day: "Wednesday",
            startTime: "1400",
            endTime: "1600",
            venue: "BIZ1-B1-B3",
            weeks: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13]
          },
          {
            classNo: "03",
            lessonType: "Tutorial",
            day: "Friday",
            startTime: "1400",
            endTime: "1500",
            venue: "BIZ2-0402",
            weeks: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13]
          }
        ]
      }
    ]
  }
};

// Mock users in the system
export const MOCK_USERS = [
  { id: 1, name: "Alice", email: "alice@u.nus.edu" },
  { id: 2, name: "Bob", email: "bob@u.nus.edu" },
  { id: 3, name: "Charlie", email: "charlie@u.nus.edu" }
];

// Mock timetable entries (module selections per user)
export const MOCK_TIMETABLE_ENTRIES = [
  // Alice: CS2030S + MA2001
  { userId: 1, moduleCode: "CS2030S", lessonType: "Lecture", classNo: "1" },
  { userId: 1, moduleCode: "CS2030S", lessonType: "Tutorial", classNo: "04" },
  { userId: 1, moduleCode: "MA2001", lessonType: "Lecture", classNo: "1" },
  { userId: 1, moduleCode: "MA2001", lessonType: "Tutorial", classNo: "01" },
  // Bob: CS2030S + IS1108
  { userId: 2, moduleCode: "CS2030S", lessonType: "Lecture", classNo: "2" },
  { userId: 2, moduleCode: "CS2030S", lessonType: "Tutorial", classNo: "05" },
  { userId: 2, moduleCode: "IS1108", lessonType: "Lecture", classNo: "1" },
  { userId: 2, moduleCode: "IS1108", lessonType: "Tutorial", classNo: "03" },
  // Charlie: MA2001 + IS1108
  { userId: 3, moduleCode: "MA2001", lessonType: "Lecture", classNo: "1" },
  { userId: 3, moduleCode: "MA2001", lessonType: "Tutorial", classNo: "02" },
  { userId: 3, moduleCode: "IS1108", lessonType: "Lecture", classNo: "1" },
  { userId: 3, moduleCode: "IS1108", lessonType: "Tutorial", classNo: "03" }
];

// Mock custom events (user-created events)
export const MOCK_CUSTOM_EVENTS = [
  // Alice: Gym on Friday
  {
    id: "custom-1",
    userId: 1,
    title: "Gym",
    day: "Friday",
    startTime: "0800",
    endTime: "0900",
    color: "#34d399"
  },
  // Bob: Guitar CCA on Wednesday
  {
    id: "custom-2",
    userId: 2,
    title: "Guitar CCA",
    day: "Wednesday",
    startTime: "1800",
    endTime: "2000",
    color: "#f59e0b"
  },
  // Charlie: Study Group on Thursday
  {
    id: "custom-3",
    userId: 3,
    title: "Study Group",
    day: "Thursday",
    startTime: "1400",
    endTime: "1600",
    color: "#818cf8"
  }
];

// Mock groups
export const MOCK_GROUPS = [
  {
    id: 1,
    name: "CS Project Group",
    memberIds: [1, 2, 3]
  }
];

// Current logged-in user (hardcoded for demo)
export const CURRENT_USER_ID = 1; // Alice
