---
name: check
description: "Check the status of skills — which are locked, learning, or unlocked. Use when user asks 'what skills do I have', 'what's locked', or 'show my progress'."
argument-hint: "[topic]"
allowed-tools: mcp__deeplearn__list_skills mcp__deeplearn__check_skill mcp__deeplearn__search_knowledge
---

## DeepLearn: Check Skills

If `$ARGUMENTS` is provided, call `check_skill` for that specific skill ID.
Otherwise, call `list_skills` (no filter) to get the full inventory.

### Display Format

Group results by status:

**Unlocked** (implement freely)
- List each with name, category, and linked notes

**Learning** (notes in progress)
- List each with name and what docs they should be reading

**Locked** (not yet started)
- List each with name

If there are no skills registered yet, tell the user they can start with `/deeplearn:learn <topic>` or that the plugin will automatically detect locked concepts when they ask for help.
