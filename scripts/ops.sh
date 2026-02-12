#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${BASE_URL:-https://jeffborowitz.com/accounting-demo}"
BASE_URL="${BASE_URL%/}"
BRANCH="${BRANCH:-main}"
RUN_LIMIT="${RUN_LIMIT:-5}"

usage() {
  cat <<'EOF'
Usage: scripts/ops.sh <command>

Local:
  local-setup      Create/update .venv and install deps
  local-test       Run unittest suite
  local-run        Run API locally (uvicorn)
  local-smoke      Curl local health and demo endpoints

Deploy:
  deploy-push      Push branch to origin (default: main)
  deploy-runs      List recent GitHub Actions runs
  deploy-watch     Watch latest run until completion
  deploy-failed    Show failed logs for latest run
  deploy-check     Curl deployed API endpoints

GitHub auth:
  gh-login-check   Show current gh auth status
EOF
}

require_cmd() {
  command -v "$1" >/dev/null 2>&1 || { echo "missing command: $1" >&2; exit 1; }
}

case "${1:-}" in
  local-setup)
    ./scripts/setup_local_env.sh
    ;;
  local-test)
    ./scripts/test_local.sh
    ;;
  local-run)
    source .venv/bin/activate
    uvicorn app.main:app --reload --port 8002
    ;;
  local-smoke)
    curl -fsSL "http://127.0.0.1:8002/health" && echo
    curl -fsSL "http://127.0.0.1:8002/api/v1/health" && echo
    curl -fsSL "http://127.0.0.1:8002/api/v1/demo/summary" && echo
    curl -fsSL "http://127.0.0.1:8002/api/v1/demo/match-summary" && echo
    ;;
  deploy-push)
    require_cmd git
    git push origin "$BRANCH"
    ;;
  deploy-runs)
    require_cmd gh
    gh run list --limit "$RUN_LIMIT"
    ;;
  deploy-watch)
    require_cmd gh
    run_id="$(gh run list --limit 1 --json databaseId --jq '.[0].databaseId')"
    gh run watch "$run_id"
    ;;
  deploy-failed)
    require_cmd gh
    run_id="$(gh run list --limit 1 --json databaseId --jq '.[0].databaseId')"
    gh run view "$run_id" --log-failed
    ;;
  deploy-check)
    curl -fsSL "$BASE_URL/health" && echo
    curl -fsSL "$BASE_URL/api/v1/health" && echo
    curl -fsSL "$BASE_URL/api/v1/demo/summary" && echo
    curl -fsSL "$BASE_URL/api/v1/demo/match-summary" && echo
    curl -fsSL -X POST "$BASE_URL/api/v1/demo/match-runs" && echo
    curl -fsSL "$BASE_URL/api/v1/demo/exceptions?status=open&limit=5" && echo
    ;;
  gh-login-check)
    require_cmd gh
    gh auth status
    ;;
  *)
    usage
    exit 1
    ;;
esac
