#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

echo "== Environment =="
node --version
npm --version

echo "== Workspace manifest checks =="
test -f package.json
test -f apps/backend/package.json
test -f apps/frontend/package.json

echo "== Dependency installation =="
# Until package-lock.json is committed, npm install is the supported fallback.
npm install --no-audit --no-fund

echo "== TypeScript typecheck =="
npm run typecheck

echo "== Backend unit tests =="
npm test

echo "== Frontend production build =="
npm run build:frontend

echo "VALIDATION PASSED"
