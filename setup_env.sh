#!/usr/bin/env bash
set -e

cd "$(dirname "$0")"

if [ ! -d ".venv" ]; then
  python3 -m venv .venv
fi

. .venv/bin/activate
pip install --upgrade pip
pip install -r requirements.txt

echo ""
echo "Environment ready."
echo "Run with:"
echo "  . .venv/bin/activate"
echo "  python app.py"
