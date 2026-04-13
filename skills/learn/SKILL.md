---
name: learn
description: "Start learning a new skill. Searches the vault for existing knowledge first, then creates a skill entry if needed. Use when user says 'I want to learn X' or 'teach me X'."
argument-hint: "<topic>"
allowed-tools: mcp__deeplearn__create_skill mcp__deeplearn__search_knowledge mcp__deeplearn__check_skill mcp__deeplearn__link_notes mcp__deeplearn__unlock_skill
---

## DeepLearn: Start Learning

The user wants to learn about: $ARGUMENTS

### Protocol

1. Call `check_skill` to see if a skill already exists for this topic.
   - If it exists and is unlocked, tell them — nothing to do.
   - If it exists and is learning, remind them to keep going.

2. If no skill exists, call `search_knowledge` to check their vault for existing notes on this topic.

3. **If search finds strong matches** (notes with real substance about the topic):
   - Call `create_skill` to register it
   - Call `link_notes` to attach the discovered notes
   - Evaluate the notes: if they clearly demonstrate understanding, call `unlock_skill` directly — the user already knows this.
   - If the notes are partial/shallow, keep it in `learning` status and tell them what's missing.

4. **If search finds nothing or weak matches**:
   - Call `create_skill` to register it (this drops an optional template at the vault root)
   - Present the documentation links and explain what they need to learn
   - Tell them: "Write notes however you like — anywhere in your vault. When you're ready, run `/deeplearn:submit <skill-id>`."
   - The template is just a suggestion. They can use it, move it, or ignore it entirely.

### Rules

- Do NOT explain the concept yourself — point to docs. You are a guide, not a teacher.
- Do NOT write implementation code for this concept.
- You MAY give a 1-2 sentence overview so the user knows they're looking at the right thing.
- Respect the user's existing vault structure. Never tell them where to put their notes.
