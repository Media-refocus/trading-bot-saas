#!/bin/bash
# Ralph Wiggum - Autonomous AI agent loop for Trading Bot SaaS
# Adapted from snarktank/ralph for OpenClaw + launch-cc.sh
# Usage: ./scripts/ralph/ralph.sh [max_iterations]

set -e

MAX_ITERATIONS=${1:-10}
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"
PRD_FILE="$SCRIPT_DIR/prd.json"
PROGRESS_FILE="$SCRIPT_DIR/progress.txt"
ARCHIVE_DIR="$SCRIPT_DIR/archive"

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m'

# Validate prd.json exists
if [ ! -f "$PRD_FILE" ]; then
  echo -e "${RED}Error: No prd.json found at $PRD_FILE${NC}"
  echo "Create one with user stories first."
  exit 1
fi

# Archive previous run if branch changed
LAST_BRANCH_FILE="$SCRIPT_DIR/.last-branch"
if [ -f "$PRD_FILE" ] && [ -f "$LAST_BRANCH_FILE" ]; then
  CURRENT_BRANCH=$(jq -r '.branchName // empty' "$PRD_FILE" 2>/dev/null || echo "")
  LAST_BRANCH=$(cat "$LAST_BRANCH_FILE" 2>/dev/null || echo "")
  
  if [ -n "$CURRENT_BRANCH" ] && [ -n "$LAST_BRANCH" ] && [ "$CURRENT_BRANCH" != "$LAST_BRANCH" ]; then
    DATE=$(date +%Y-%m-%d)
    FOLDER_NAME=$(echo "$LAST_BRANCH" | sed 's|^ralph/||')
    ARCHIVE_FOLDER="$ARCHIVE_DIR/$DATE-$FOLDER_NAME"
    
    echo -e "${YELLOW}Archiving previous run: $LAST_BRANCH${NC}"
    mkdir -p "$ARCHIVE_FOLDER"
    [ -f "$PRD_FILE" ] && cp "$PRD_FILE" "$ARCHIVE_FOLDER/"
    [ -f "$PROGRESS_FILE" ] && cp "$PROGRESS_FILE" "$ARCHIVE_FOLDER/"
    
    # Reset progress for new run
    echo "# Ralph Progress Log" > "$PROGRESS_FILE"
    echo "Started: $(date)" >> "$PROGRESS_FILE"
    echo "---" >> "$PROGRESS_FILE"
  fi
fi

# Track current branch
if [ -f "$PRD_FILE" ]; then
  CURRENT_BRANCH=$(jq -r '.branchName // empty' "$PRD_FILE" 2>/dev/null || echo "")
  if [ -n "$CURRENT_BRANCH" ]; then
    echo "$CURRENT_BRANCH" > "$LAST_BRANCH_FILE"
  fi
fi

# Initialize progress file if needed
if [ ! -f "$PROGRESS_FILE" ]; then
  echo "# Ralph Progress Log" > "$PROGRESS_FILE"
  echo "Started: $(date)" >> "$PROGRESS_FILE"
  echo "---" >> "$PROGRESS_FILE"
fi

# Ensure we're on the right branch
cd "$PROJECT_DIR"
BRANCH_NAME=$(jq -r '.branchName' "$PRD_FILE")
CURRENT_GIT_BRANCH=$(git branch --show-current)

if [ "$CURRENT_GIT_BRANCH" != "$BRANCH_NAME" ]; then
  echo -e "${BLUE}Switching to branch: $BRANCH_NAME${NC}"
  git checkout "$BRANCH_NAME" 2>/dev/null || git checkout -b "$BRANCH_NAME"
fi

echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}  Ralph Loop - Trading Bot SaaS${NC}"
echo -e "${GREEN}  Branch: $BRANCH_NAME${NC}"
echo -e "${GREEN}  Max iterations: $MAX_ITERATIONS${NC}"
echo -e "${GREEN}========================================${NC}"

for i in $(seq 1 $MAX_ITERATIONS); do
  echo ""
  echo -e "${BLUE}===============================================================${NC}"
  echo -e "${BLUE}  Ralph Iteration $i of $MAX_ITERATIONS${NC}"
  echo -e "${BLUE}  $(date '+%Y-%m-%d %H:%M:%S')${NC}"
  echo -e "${BLUE}===============================================================${NC}"

  # Check if all stories are done before starting
  REMAINING=$(jq '[.userStories[] | select(.passes == false)] | length' "$PRD_FILE")
  if [ "$REMAINING" -eq 0 ]; then
    echo -e "${GREEN}🎉 All user stories completed!${NC}"
    echo "Completed at iteration $i of $MAX_ITERATIONS"
    
    # Push the branch
    git push origin "$BRANCH_NAME" 2>/dev/null || true
    exit 0
  fi

  echo -e "${YELLOW}Remaining stories: $REMAINING${NC}"

  # Build the prompt from CLAUDE.md template
  PROMPT=$(cat "$SCRIPT_DIR/CLAUDE.md")

  # Run Claude Code with --dangerously-skip-permissions for autonomous operation
  OUTPUT=$(cd "$PROJECT_DIR" && claude \
    --dangerously-skip-permissions \
    --print \
    --output-format text \
    -p "$PROMPT" \
    2>&1 | tee /dev/stderr) || true

  # Check for completion signal
  if echo "$OUTPUT" | grep -q "COMPLETE"; then
    echo ""
    echo -e "${GREEN}🎉 Ralph completed all tasks!${NC}"
    echo "Completed at iteration $i of $MAX_ITERATIONS"
    git push origin "$BRANCH_NAME" 2>/dev/null || true
    exit 0
  fi

  echo -e "${YELLOW}Iteration $i complete. Sleeping 5s before next...${NC}"
  sleep 5
done

echo ""
echo -e "${RED}Ralph reached max iterations ($MAX_ITERATIONS) without completing all tasks.${NC}"
echo "Check $PROGRESS_FILE for status."
exit 1
