#!/usr/bin/env bash
set -euo pipefail

if [ ! -d ".venv" ]; then
  python3 -m venv .venv
fi

source .venv/bin/activate
python -m pip --version

if python -m pip install -r requirements.txt; then
  echo "Dependencies installed."
else
  echo "Dependency installation failed (likely network restriction)."
  echo "Retry this command when internet access is available:"
  echo "source .venv/bin/activate && pip install -r requirements.txt"
fi
