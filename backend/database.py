import sqlite3
import os
from pathlib import Path

DB_PATH = os.path.join(os.path.dirname(__file__), "timetable.db")


def get_connection():
    """Get a database connection."""
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def _ensure_slot_overrides_table(cursor):
    """Create the slot_overrides table if it doesn't exist yet (migration-safe)."""
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS slot_overrides (
        user_id INTEGER NOT NULL,
        module_code TEXT NOT NULL,
        lesson_type TEXT NOT NULL,
        class_no TEXT NOT NULL,
        color TEXT,
        label TEXT,
        PRIMARY KEY (user_id, module_code, lesson_type, class_no),
        FOREIGN KEY (user_id) REFERENCES users(id)
    )
    """)


def init_db():
    """Initialize the database schema."""
    if os.path.exists(DB_PATH):
        conn = get_connection()
        cursor = conn.cursor()
        prune_legacy_demo_account(cursor)
        _ensure_slot_overrides_table(cursor)
        conn.commit()
        conn.close()
        return  # Database already exists

    conn = get_connection()
    cursor = conn.cursor()

    # Create users table
    cursor.execute("""
    CREATE TABLE users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        email TEXT UNIQUE NOT NULL
    )
    """)

    # Create timetable_entries table (NUSMods module selections)
    cursor.execute("""
    CREATE TABLE timetable_entries (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        module_code TEXT NOT NULL,
        lesson_type TEXT NOT NULL,
        class_no TEXT NOT NULL,
        semester INTEGER DEFAULT 1,
        FOREIGN KEY (user_id) REFERENCES users(id)
    )
    """)

    # Create custom_events table
    cursor.execute("""
    CREATE TABLE custom_events (
        id TEXT PRIMARY KEY,
        user_id INTEGER NOT NULL,
        title TEXT NOT NULL,
        day TEXT NOT NULL,
        start_time TEXT NOT NULL,
        end_time TEXT NOT NULL,
        color TEXT DEFAULT '#60a5fa',
        FOREIGN KEY (user_id) REFERENCES users(id)
    )
    """)

    # Create groups table
    cursor.execute("""
    CREATE TABLE groups (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL
    )
    """)

    # Create group_members table
    cursor.execute("""
    CREATE TABLE group_members (
        group_id INTEGER,
        user_id INTEGER,
        PRIMARY KEY (group_id, user_id),
        FOREIGN KEY (group_id) REFERENCES groups(id),
        FOREIGN KEY (user_id) REFERENCES users(id)
    )
    """)

    _ensure_slot_overrides_table(cursor)

    # Seed mock data
    seed_data(cursor)

    conn.commit()
    conn.close()


def prune_legacy_demo_account(cursor):
    """Remove the old placeholder Delta account if it is still present."""
    cursor.execute("SELECT id, name, email FROM users WHERE id = ?", (7,))
    user_row = cursor.fetchone()
    if not user_row:
        return

    if user_row["name"] != "Delta" or user_row["email"] != "delta@u.nus.edu":
        return

    cursor.execute("SELECT 1 FROM timetable_entries WHERE user_id = ? LIMIT 1", (7,))
    has_timetable = cursor.fetchone() is not None
    cursor.execute("SELECT 1 FROM custom_events WHERE user_id = ? LIMIT 1", (7,))
    has_events = cursor.fetchone() is not None

    if has_timetable or has_events:
        return

    cursor.execute("DELETE FROM group_members WHERE user_id = ?", (7,))
    cursor.execute("DELETE FROM users WHERE id = ?", (7,))


def seed_data(cursor):
    """Seed the database with mock data."""
    # Insert mock users
    cursor.execute("INSERT INTO users (id, name, email) VALUES (?, ?, ?)", (1, "Alice", "alice@u.nus.edu"))
    cursor.execute("INSERT INTO users (id, name, email) VALUES (?, ?, ?)", (2, "Bob", "bob@u.nus.edu"))
    cursor.execute("INSERT INTO users (id, name, email) VALUES (?, ?, ?)", (3, "Charlie", "charlie@u.nus.edu"))

    # Insert mock timetable entries
    entries = [
        # Alice: CS2030S + MA2001
        (1, "CS2030S", "Lecture", "1"),
        (1, "CS2030S", "Tutorial", "04"),
        (1, "MA2001", "Lecture", "1"),
        (1, "MA2001", "Tutorial", "01"),
        # Bob: CS2030S + IS1108
        (2, "CS2030S", "Lecture", "2"),
        (2, "CS2030S", "Tutorial", "05"),
        (2, "IS1108", "Lecture", "1"),
        (2, "IS1108", "Tutorial", "03"),
        # Charlie: MA2001 + IS1108
        (3, "MA2001", "Lecture", "1"),
        (3, "MA2001", "Tutorial", "02"),
        (3, "IS1108", "Lecture", "1"),
        (3, "IS1108", "Tutorial", "03"),
    ]

    for user_id, module_code, lesson_type, class_no in entries:
        cursor.execute(
            "INSERT INTO timetable_entries (user_id, module_code, lesson_type, class_no) VALUES (?, ?, ?, ?)",
            (user_id, module_code, lesson_type, class_no)
        )

    # Insert mock custom events
    custom_events = [
        ("custom-1", 1, "Gym", "Friday", "0800", "0900", "#34d399"),
        ("custom-2", 2, "Guitar CCA", "Wednesday", "1800", "2000", "#f59e0b"),
        ("custom-3", 3, "Study Group", "Thursday", "1400", "1600", "#818cf8"),
    ]

    for event_id, user_id, title, day, start_time, end_time, color in custom_events:
        cursor.execute(
            "INSERT INTO custom_events (id, user_id, title, day, start_time, end_time, color) VALUES (?, ?, ?, ?, ?, ?, ?)",
            (event_id, user_id, title, day, start_time, end_time, color)
        )

    # Insert mock groups
    cursor.execute("INSERT INTO groups (id, name) VALUES (?, ?)", (1, "CS Project Group"))

    # Insert group members
    for user_id in [1, 2, 3]:
        cursor.execute("INSERT INTO group_members (group_id, user_id) VALUES (?, ?)", (1, user_id))


def get_user_timetable(user_id):
    """Get a user's module selections and custom events."""
    conn = get_connection()
    cursor = conn.cursor()

    # Get module selections
    cursor.execute(
        "SELECT module_code, lesson_type, class_no FROM timetable_entries WHERE user_id = ? ORDER BY module_code",
        (user_id,)
    )
    module_selections = [dict(row) for row in cursor.fetchall()]

    # Get custom events
    cursor.execute(
        "SELECT id, title, day, start_time, end_time, color FROM custom_events WHERE user_id = ?",
        (user_id,)
    )
    custom_events = [dict(row) for row in cursor.fetchall()]

    # Get per-slot overrides (user edits to NUSMods-sourced color/label).
    # These are kept separate from timetable_entries so a future NUSMods
    # re-import never wipes them out implicitly.
    cursor.execute(
        "SELECT module_code, lesson_type, class_no, color, label FROM slot_overrides WHERE user_id = ?",
        (user_id,)
    )
    slot_overrides = [dict(row) for row in cursor.fetchall()]

    conn.close()
    return {
        "moduleSelections": module_selections,
        "customEvents": custom_events,
        "slotOverrides": slot_overrides
    }


def pick_value(record, *keys, default=None):
    """Read the first present value from a dict-like object."""
    for key in keys:
        if key in record and record[key] is not None:
            return record[key]

    return default


def update_user_timetable(user_id, module_selections, custom_events):
    """Update a user's timetable entries and custom events."""
    conn = get_connection()
    cursor = conn.cursor()

    try:
        # Delete existing entries
        cursor.execute("DELETE FROM timetable_entries WHERE user_id = ?", (user_id,))
        cursor.execute("DELETE FROM custom_events WHERE user_id = ?", (user_id,))

        # Insert new module selections
        for entry in module_selections:
            cursor.execute(
                "INSERT INTO timetable_entries (user_id, module_code, lesson_type, class_no) VALUES (?, ?, ?, ?)",
                (
                    user_id,
                    pick_value(entry, "moduleCode", "module_code"),
                    pick_value(entry, "lessonType", "lesson_type"),
                    pick_value(entry, "classNo", "class_no")
                )
            )

        # Insert new custom events
        for event in custom_events:
            cursor.execute(
                "INSERT INTO custom_events (id, user_id, title, day, start_time, end_time, color) VALUES (?, ?, ?, ?, ?, ?, ?)",
                (
                    pick_value(event, "id"),
                    user_id,
                    pick_value(event, "title"),
                    pick_value(event, "day"),
                    pick_value(event, "startTime", "start_time"),
                    pick_value(event, "endTime", "end_time"),
                    pick_value(event, "color", default="#60a5fa")
                )
            )

        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


def create_group(name, member_ids):
    """Create a new group with members."""
    conn = get_connection()
    cursor = conn.cursor()

    cursor.execute("INSERT INTO groups (name) VALUES (?)", (name,))
    group_id = cursor.lastrowid

    for user_id in member_ids:
        cursor.execute("INSERT INTO group_members (group_id, user_id) VALUES (?, ?)", (group_id, user_id))

    conn.commit()
    conn.close()
    return group_id


def get_group_with_members(group_id):
    """Get a group with all member timetable data."""
    conn = get_connection()
    cursor = conn.cursor()

    # Get group info
    cursor.execute("SELECT id, name FROM groups WHERE id = ?", (group_id,))
    group_row = cursor.fetchone()
    if not group_row:
        conn.close()
        return None

    group = dict(group_row)

    # Get group members
    cursor.execute(
        "SELECT gm.user_id, u.name FROM group_members gm JOIN users u ON gm.user_id = u.id WHERE gm.group_id = ?",
        (group_id,)
    )
    members = []
    for row in cursor.fetchall():
        user_id = row["user_id"]
        name = row["name"]

        # Get user's timetable data
        cursor.execute(
            "SELECT module_code, lesson_type, class_no FROM timetable_entries WHERE user_id = ?",
            (user_id,)
        )
        module_selections = [dict(r) for r in cursor.fetchall()]

        cursor.execute(
            "SELECT id, title, day, start_time, end_time, color FROM custom_events WHERE user_id = ?",
            (user_id,)
        )
        custom_events = [dict(r) for r in cursor.fetchall()]

        members.append({
            "userId": user_id,
            "name": name,
            "moduleSelections": module_selections,
            "customEvents": custom_events
        })

    conn.close()
    return {
        "groupId": group["id"],
        "name": group["name"],
        "members": members
    }
