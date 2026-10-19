from flask import Flask, render_template, request, jsonify
from pathlib import Path
import os
import subprocess

app = Flask(__name__, template_folder="templates", static_folder="static")

BASE_DIR = Path(__file__).resolve().parent
WORKSPACE = BASE_DIR
VENV_BIN = BASE_DIR / ".venv" / "bin"


def build_env():
    env = os.environ.copy()
    env["TERM"] = "xterm-256color"
    env["PWD"] = str(WORKSPACE)
    if VENV_BIN.exists():
        env["PATH"] = f"{VENV_BIN}{os.pathsep}{env.get('PATH', '')}"
    return env


def run_shell_command(command: str):
    if not command.strip():
        return {"ok": False, "rc": 1, "output": "No command provided."}

    env = build_env()
    try:
        result = subprocess.run(
            command,
            shell=True,
            capture_output=True,
            text=True,
            timeout=15,
            cwd=str(WORKSPACE),
            env=env,
        )
        combined = "\n".join(
            part for part in [result.stdout.strip(), result.stderr.strip()] if part
        )
        return {
            "ok": result.returncode == 0,
            "rc": result.returncode,
            "output": combined if combined else "",
        }
    except subprocess.TimeoutExpired:
        return {
            "ok": False,
            "rc": 124,
            "output": "Command timed out after 15 seconds.",
        }


@app.route("/")
def index():
    return render_template("index.html")


@app.route("/api/command", methods=["POST"])
def api_command():
    payload = request.get_json(silent=True) or {}
    command = str(payload.get("command", "")).strip()
    if not command:
        return jsonify({"ok": False, "rc": 1, "output": "No command provided."})
    result = run_shell_command(command)
    return jsonify(result)


@app.route("/api/save", methods=["POST"])
def api_save():
    payload = request.get_json(silent=True) or {}
    file_path = str(payload.get("path", "workspace/app.py")).strip()
    content = payload.get("content", "")

    if not file_path:
        return jsonify({"ok": False, "error": "Missing file path."})

    safe_root = str(WORKSPACE.resolve())
    target = (WORKSPACE / file_path).resolve()
    try:
        target.relative_to(safe_root)
    except ValueError:
        return jsonify({"ok": False, "error": "Invalid file path."})

    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(content, encoding="utf-8")
    return jsonify({"ok": True, "path": file_path})


@app.route("/api/files")
def api_files():
    items = []
    for p in sorted(WORKSPACE.iterdir()):
        if p.name.startswith(".") and p.name not in [".venv"]:
            continue
        items.append({
            "name": p.name,
            "type": "directory" if p.is_dir() else "file",
        })
    return jsonify({"items": items})


if __name__ == "__main__":
    app.run(host="127.0.0.1", port=5000, debug=True)
