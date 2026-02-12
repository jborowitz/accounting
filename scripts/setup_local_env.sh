#!/usr/bin/env bash
set -euo pipefail

PYTHON_BIN="${PYTHON_BIN:-$(command -v python3)}"

if [ ! -d ".venv" ]; then
  "$PYTHON_BIN" -m venv .venv
fi

source .venv/bin/activate
echo "Using local venv base interpreter: $PYTHON_BIN"
python --version
python -m pip --version

if python -m pip install -r requirements.txt; then
  echo "Dependencies installed."
else
  echo "Dependency installation failed (likely network restriction)."
  echo "Retry this command when internet access is available:"
  echo "source .venv/bin/activate && pip install -r requirements.txt"
fi
