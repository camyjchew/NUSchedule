from flask import Flask, jsonify, request, render_template_string, session
import os
from flask_cors import CORS
from database import init_db, get_connection, get_user_timetable, update_user_timetable, create_group, get_group_with_members

# Imports Flask and enables CORS (Cross-Origin Resource Sharing)
# so the frontend can communicate with the backend without cross-origin blocks, and imports
# database helper functions from `database.py`.

app = Flask(__name__)
CORS(app)

# Secret key for session signing (development only). Override with env var in production.
app.secret_key = os.environ.get("SECRET_KEY", "dev-secret")

# Initialize database on startup
init_db()

# User id comes from the session or request; there is no hardcoded default user.
CURRENT_USER_ID = None

# Whenever the backend needs to know who is making a request, it runs resolve_user_id().
def resolve_user_id(default_user_id=CURRENT_USER_ID):
    """Resolve a user id from the current request."""
    # 1. Check session
    sess_id = session.get("user_id")
    if sess_id is not None:
        return int(sess_id)

    # 2. Query param or JSON body
    raw_user_id = request.args.get("userId")
    if raw_user_id is None and request.is_json:
        raw_user_id = (request.get_json(silent=True) or {}).get("userId")

    if raw_user_id is not None:
        try:
            return int(raw_user_id)
        except (TypeError, ValueError):
            pass

    # 3. Fallback default (None by default)
    return default_user_id


# API Endpoints: specific URLs that the frontend can call.

# Determines the user from the request, retrieves their schedule using `get_user_timetable`,
# and returns the result as JSON.

@app.route("/timetable", methods=["GET"])
def get_timetable():
    """Get the current user's timetable."""
    user_id = resolve_user_id()
    if not user_id:
        return jsonify({"error": "Unauthorized"}), 401

    data = get_user_timetable(user_id)
    return jsonify(data)


# Endpoint to save a user's updated schedule.
# Expects a JSON payload with `moduleSelections` (module/course selections) and
# `customEvents` (user-created events), then updates the database.

@app.route("/timetable/update", methods=["POST"])
def update_timetable():
    """Update the current user's timetable."""
    body = request.json
    user_id = resolve_user_id()
    if not user_id:
        return jsonify({"error": "Unauthorized"}), 401
    module_selections = body.get("moduleSelections", [])
    custom_events = body.get("customEvents", [])

    update_user_timetable(user_id, module_selections, custom_events)
    return jsonify({"status": "success"})


# What it does: Creates a new study group or friend group.
# How it works: The frontend sends a group name and a list of memberIds. 
# The backend inserts this into the database and replies back with the newly created groupId.

@app.route("/group", methods=["POST"])
def create_new_group():
    """Create a new group."""
    body = request.json
    name = body.get("name")
    member_ids = body.get("memberIds", [])

    group_id = create_group(name, member_ids)
    return jsonify({"groupId": group_id})


# What it does: Fetches a specific group's details along with the timetables of everyone 
# inside that group.
# How it works: The <int:group_id> part means the URL will look like /group/12. 
# It looks up group 12. If it doesn't exist, it sends back a 404 Not Found error. If it does, 
# it returns the group data. This is used to find common free times between friends.

@app.route("/group/<int:group_id>", methods=["GET"])
def get_group(group_id):
    """Get group with all members' timetable data."""
    group = get_group_with_members(group_id)
    if not group:
        return jsonify({"error": "Group not found"}), 404
    return jsonify(group)

# Simple session-based login endpoint for demo purposes.
@app.route("/login", methods=["POST"])
def login():
    body = request.get_json(silent=True) or {}
    user_id = body.get("userId")
    if user_id is None:
        return jsonify({"error": "userId required"}), 400

    try:
        user_id = int(user_id)
    except (TypeError, ValueError):
        return jsonify({"error": "invalid userId"}), 400

    # Store the selected user in the signed session cookie.
    session["user_id"] = user_id
    return jsonify({"status": "ok", "userId": user_id})


@app.route("/logout", methods=["POST"])
def logout():
    session.pop("user_id", None)
    return jsonify({"status": "ok"})


@app.route("/me", methods=["GET"])
def me():
    user_id = session.get("user_id")
    if user_id is None:
        return jsonify({"error": "Unauthorized"}), 401

    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT id, name, email FROM users WHERE id = ?", (user_id,))
    user_row = cursor.fetchone()
    conn.close()

    if not user_row:
        return jsonify({"error": "Unauthorized"}), 401

    return jsonify({
        "userId": int(user_row["id"]),
        "name": user_row["name"],
        "email": user_row["email"]
    })

    
@app.route("/register", methods=["POST"])
def register():
    """Register a new user record with no timetable data yet."""
    body = request.get_json(silent=True) or {}
    name = body.get("name")
    email = body.get("email")

    if not name or not email:
        return jsonify({"error": "name and email required"}), 400

    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT id FROM users WHERE email = ?", (email,))
    existing_user = cursor.fetchone()
    if existing_user:
        user_id = existing_user["id"]

        # Recreate the account as blank for testing purposes.
        cursor.execute("DELETE FROM timetable_entries WHERE user_id = ?", (user_id,))
        cursor.execute("DELETE FROM custom_events WHERE user_id = ?", (user_id,))
        # Ensure the user is a member of the sample group (group_id=1) for development
        try:
            cursor.execute("INSERT OR IGNORE INTO group_members (group_id, user_id) VALUES (?, ?)", (1, user_id))
        except Exception:
            pass

        conn.commit()
        conn.close()
        return jsonify({"status": "existing", "userId": user_id, "persisted": True})

    try:
        cursor.execute("INSERT INTO users (name, email) VALUES (?, ?)", (name, email))
        conn.commit()
        created_id = cursor.lastrowid

        # Add the new user to the sample group (group_id=1) so they show up in the Group View
        try:
            cursor.execute("INSERT OR IGNORE INTO group_members (group_id, user_id) VALUES (?, ?)", (1, created_id))
            conn.commit()
        except Exception:
            # Non-fatal for development convenience
            pass

        conn.close()
        return jsonify({"status": "created", "userId": created_id, "persisted": True})
    except Exception as e:
        conn.close()
        return jsonify({"error": str(e)}), 500


@app.route("/users", methods=["GET"])
def list_users():
    """List all users available for the login screen."""
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT id, name, email FROM users ORDER BY id")
    users = [dict(row) for row in cursor.fetchall()]
    conn.close()
    return jsonify({"users": users})


@app.route("/health", methods=["GET"])
def health_check():
    """Health check endpoint."""
    return jsonify({"status": "ok"})


@app.route("/", methods=["GET"])
def root():
    """Simple root response for quick backend checks."""
    return "Backend is running"


if __name__ == "__main__":
    app.run(debug=True, port=5001, use_reloader=False)
