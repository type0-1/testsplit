#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

JUNIT_PATH="${1:-__tests__/backend/integration/core/fixtures/surefire-reports}"
JOBS="${2:-4}"

TARGETED_TESTS=(
  "__tests__/backend/unit/parser/parser.test.ts"
  "__tests__/backend/unit/profiler/Profiler.test.ts"
  "__tests__/backend/unit/storage/FileStore.test.ts"
)

has_script() {
  npm run --silent | awk '{print $1}' | grep -Fxq "$1"
}

echo "[1/7] Lint"
if has_script lint; then
  npm run lint
else
  echo "Skipping: no lint script in package.json"
fi

echo "[2/7] Build"
if has_script build; then
  npm run build
else
  echo "Skipping: no build script in package.json"
fi

echo "[3/7] Full unit test suite"
npm test

echo "[4/7] Targeted tests"
npm run test:unit -- "${TARGETED_TESTS[@]}"

echo "[5/7] Real CLI profile run"
npx ts-node src/backend/cli/cli.ts profile --junit "$JUNIT_PATH" --jobs "$JOBS"

echo "[6/7] Real CLI config generation (dry-run)"
mkdir -p .data/tmp
npx ts-node src/backend/cli/cli.ts generate-config \
  --junit "$JUNIT_PATH" \
  --jobs "$JOBS" \
  --platform github \
  --dry-run > .data/tmp/generated-github.yml

echo "[7/7] Validate persisted metadata fields"
LATEST_PROFILE="$(ls -t .data/profiles/*.json 2>/dev/null | grep -v '/historical\.json$' | head -n 1 || true)"

if [[ -z "$LATEST_PROFILE" ]]; then
  echo "FAIL: no run profile found under .data/profiles after CLI execution"
  exit 1
fi

node - "$LATEST_PROFILE" <<'NODE'
const fs = require('fs');
const profilePath = process.argv[2];
const profile = JSON.parse(fs.readFileSync(profilePath, 'utf-8'));

function fail(msg) {
  console.error(`FAIL: ${msg}`);
  process.exit(1);
}

if (!Array.isArray(profile.testResults) || profile.testResults.length === 0) {
  fail('profile has no testResults');
}

const hasClassName = profile.testResults.some((t) => typeof t.className === 'string' && t.className.length > 0);
const hasPackageName = profile.testResults.some((t) => typeof t.packageName === 'string' && t.packageName.length > 0);
const hasFilePath = profile.testResults.some((t) => typeof t.filePath === 'string' && t.filePath.length > 0);

if (!hasClassName) fail('no test result has className');
if (!hasPackageName) fail('no test result has packageName');
if (!hasFilePath) fail('no test result has filePath');

const groupings = profile.metadata && profile.metadata.groupings;
if (!groupings) fail('metadata.groupings is missing');
if (!groupings.byFilePath || typeof groupings.byFilePath !== 'object') fail('metadata.groupings.byFilePath is missing');
if (!groupings.byPackage || typeof groupings.byPackage !== 'object') fail('metadata.groupings.byPackage is missing');
if (!groupings.byClassName || typeof groupings.byClassName !== 'object') fail('metadata.groupings.byClassName is missing');

console.log(`OK: validated profile metadata at ${profilePath}`);
NODE

echo "All confidence checks passed."
