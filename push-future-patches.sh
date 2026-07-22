#!/usr/bin/env bash
set -Eeuo pipefail

echo
echo "YH Academy — Safe Patch Push"
echo "============================"

if ! git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  echo "ERROR: Run this script inside the YH Academy Git repository."
  exit 1
fi

ROOT="$(git rev-parse --show-toplevel)"
cd "$ROOT"

BRANCH="$(git branch --show-current)"
if [[ -z "$BRANCH" ]]; then
  echo "ERROR: Detached HEAD detected. Switch to a branch before pushing."
  exit 1
fi

if ! git remote get-url origin >/dev/null 2>&1; then
  echo "ERROR: Git remote 'origin' is not configured."
  exit 1
fi

COMMIT_MESSAGE="${*:-}"
if [[ -z "$COMMIT_MESSAGE" ]]; then
  read -r -p "Commit message: " COMMIT_MESSAGE
fi

if [[ -z "${COMMIT_MESSAGE// }" ]]; then
  echo "ERROR: Commit message cannot be empty."
  exit 1
fi

echo
echo "Current branch: $BRANCH"
echo "Working tree before staging:"
git status --short || true

# Stage project changes while excluding downloaded patch runners,
# automatic patch backups, local secrets, and dependency folders.
git add -A -- . \
  ':(exclude)patch-phase-*.py' \
  ':(exclude)**/patch-phase-*.py' \
  ':(exclude)*.backup-phase-*' \
  ':(exclude)**/*.backup-phase-*' \
  ':(exclude).env' \
  ':(exclude).env.local' \
  ':(exclude).env.production' \
  ':(exclude).env.development' \
  ':(exclude).env.test' \
  ':(exclude)node_modules/**'

if git diff --cached --quiet; then
  echo
  echo "Nothing to commit. Patch files/backups may be the only remaining changes."
  exit 0
fi

echo
echo "Files staged for commit:"
git diff --cached --name-status

echo
echo "Checking staged diff..."
if ! git diff --cached --check; then
  echo
  echo "ERROR: Git found whitespace or conflict-marker problems."
  echo "No commit or push was performed."
  exit 1
fi

echo
read -r -p "Commit and push these files to origin/$BRANCH? [y/N]: " CONFIRM
case "$CONFIRM" in
  y|Y|yes|YES)
    ;;
  *)
    echo "Cancelled. Staged files were left intact for review."
    exit 0
    ;;
esac

git commit -m "$COMMIT_MESSAGE"
git push -u origin "$BRANCH"

echo
echo "Push completed successfully."
echo "Branch: $BRANCH"
echo "Commit: $(git rev-parse --short HEAD)"
echo
echo "Remaining local-only files:"
git status --short || true
