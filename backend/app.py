from flask import Flask, jsonify, request
from flask_cors import CORS
from database import init_db, get_user_timetable, update_user_timetable, create_group, get_group_with_members

app = Flask(__name__)
CORS(app)

# Initialize database on startup
init_db()

# Hardcoded current user (demo purposes)
CURRENT_USER_ID = 1


def resolve_user_id(default_user_id=CURRENT_USER_ID):
    """Resolve a user id from the current request."""
    raw_user_id = request.args.get("userId")
    if raw_user_id is None and request.is_json:
        raw_user_id = (request.get_json(silent=True) or {}).get("userId")

    if raw_user_id is None:
        return default_user_id

    try:
        return int(raw_user_id)
    except (TypeError, ValueError):
        return default_user_id


@app.route("/timetable", methods=["GET"])
def get_timetable():
    """Get the current user's timetable."""
    data = get_user_timetable(resolve_user_id())
    return jsonify(data)


@app.route("/timetable/update", methods=["POST"])
def update_timetable():
    """Update the current user's timetable."""
    body = request.json
    user_id = resolve_user_id()
    module_selections = body.get("moduleSelections", [])
    custom_events = body.get("customEvents", [])

    update_user_timetable(user_id, module_selections, custom_events)
    return jsonify({"status": "success"})


@app.route("/group", methods=["POST"])
def create_new_group():
    """Create a new group."""
    body = request.json
    name = body.get("name")
    member_ids = body.get("memberIds", [])

    group_id = create_group(name, member_ids)
    return jsonify({"groupId": group_id})


@app.route("/group/<int:group_id>", methods=["GET"])
def get_group(group_id):
    """Get group with all members' timetable data."""
    group = get_group_with_members(group_id)
    if not group:
        return jsonify({"error": "Group not found"}), 404
    return jsonify(group)


@app.route("/health", methods=["GET"])
def health_check():
    """Health check endpoint."""
    return jsonify({"status": "ok"})


if __name__ == "__main__":
    app.run(debug=True, port=5001, use_reloader=False)
