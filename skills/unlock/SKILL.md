---
name: unlock
description: "Unlock a skill after demonstrating understanding. Use when user says 'unlock X' after learning."
argument-hint: "<skill-id>"
allowed-tools: mcp__deeplearn__unlock_skill mcp__deeplearn__validate_notes mcp__deeplearn__check_skill mcp__deeplearn__search_knowledge mcp__deeplearn__link_notes
---

## DeepLearn: Unlock Skill

The user wants to unlock: $ARGUMENTS

### Protocol

1. Call `check_skill` to verify status.
   - Already unlocked → confirm it.
   - Locked (not learning) → suggest `/deeplearn:learn` first.
   - Doesn't exist → suggest `/deeplearn:learn` first.

2. If in `learning` status, search the vault for relevant notes and link any new ones found.

3. Call `validate_notes` to check linked notes pass.
   - If validation fails, show issues and ask them to improve their notes.

4. If validation passes, perform a quick semantic review of the note content.

5. If everything looks good, call `unlock_skill`.

6. Congratulate the user — they earned this through real learning.
