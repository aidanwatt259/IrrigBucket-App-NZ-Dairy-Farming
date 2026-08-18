#!/bin/bash
set -euo pipefail

if ! git rev-parse --verify HEAD >/dev/null 2>&1; then
  echo '{"additional_context":"This folder is not yet attached to GitHub history, so Replit pushes cannot be pulled automatically. Ask to connect local main to origin/main."}'
  exit 0
fi

if ! git rev-parse --abbrev-ref --symbolic-full-name @{u} >/dev/null 2>&1; then
  echo '{"additional_context":"No GitHub upstream is set. git pull cannot run until origin/main is tracked."}'
  exit 0
fi

if ! git diff --quiet || ! git diff --cached --quiet; then
  echo '{"additional_context":"Skipped git pull because there are local uncommitted changes."}'
  exit 0
fi

git fetch origin >/dev/null 2>&1 || {
  echo '{"additional_context":"git fetch from GitHub failed. Replit changes were not pulled."}'
  exit 0
}

before=$(git rev-parse HEAD)
if git merge --ff-only @{u} >/dev/null 2>&1; then
  after=$(git rev-parse HEAD)
  if [ "$before" != "$after" ]; then
    echo "{\"additional_context\":\"Pulled latest GitHub commits ($before -> $after). Continue with this updated code.\"}"
  else
    echo '{"additional_context":"Local main already matches GitHub."}'
  fi
else
  echo '{"additional_context":"git pull --ff-only failed. Local main has diverged from GitHub, so Replit changes were not applied automatically."}'
fi

exit 0
