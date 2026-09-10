#!/bin/bash
set -euo pipefail

workflow="Follow the Cursor-Replit loop: pull origin/main before edits, commit and push from Cursor, ask Replit AI to pull and test, then pull Replit's GitHub push before continuing."

emit() {
  printf '{"additional_context":"%s %s"}\n' "$1" "$workflow"
}

if ! git rev-parse --verify HEAD >/dev/null 2>&1; then
  emit "This folder is not yet attached to GitHub history, so Replit pushes cannot be pulled automatically. Ask to connect local main to origin/main."
  exit 0
fi

branch=$(git rev-parse --abbrev-ref HEAD)
if [ "$branch" != "main" ]; then
  emit "Currently on $branch, not main. Switch to main and pull origin/main before starting."
  exit 0
fi

if ! git rev-parse --abbrev-ref --symbolic-full-name @{u} >/dev/null 2>&1; then
  emit "No GitHub upstream is set. git pull cannot run until origin/main is tracked."
  exit 0
fi

if ! git diff --quiet || ! git diff --cached --quiet; then
  emit "Skipped git pull because there are local uncommitted changes. Commit, stash, or discard them, then pull origin/main before continuing."
  exit 0
fi

git fetch origin >/dev/null 2>&1 || {
  emit "git fetch from GitHub failed. Replit changes were not pulled."
  exit 0
fi

local_sha=$(git rev-parse HEAD)
remote_sha=$(git rev-parse @{u})
if [ "$local_sha" = "$remote_sha" ]; then
  emit "Local main already matches GitHub."
  exit 0
fi

ahead=$(git rev-list --count @{u}..HEAD)
behind=$(git rev-list --count HEAD..@{u})

if [ "$ahead" -gt 0 ] && [ "$behind" -gt 0 ]; then
  emit "git pull --ff-only cannot run: local main has diverged from GitHub (ahead $ahead, behind $behind). Stop and sync with Aidan instead of force-pushing."
  exit 0
fi

if [ "$ahead" -gt 0 ]; then
  emit "Local main is ahead of GitHub by $ahead commit(s). Push to GitHub before asking Replit AI to pull."
  exit 0
fi

if git merge --ff-only @{u} >/dev/null 2>&1; then
  after=$(git rev-parse HEAD)
  emit "Pulled latest GitHub commits ($local_sha -> $after). Continue with this updated code."
else
  emit "git pull --ff-only failed. Local main has diverged from GitHub, so Replit changes were not applied automatically."
fi

exit 0
