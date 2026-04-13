---
name: submit
description: "Submit learning for validation. Searches the vault for relevant notes, links them to the skill, and validates. Use when user says 'check my notes', 'validate my learning', or 'I'm done learning X'."
argument-hint: "<skill-id>"
allowed-tools: mcp__deeplearn__validate_notes mcp__deeplearn__check_skill mcp__deeplearn__search_knowledge mcp__deeplearn__link_notes mcp__deeplearn__unlock_skill
---

## DeepLearn: Submit for Validation

The user is submitting knowledge for: $ARGUMENTS

### Protocol

1. Call `check_skill` to verify the skill exists and is in `learning` status.

2. Call `search_knowledge` with the skill name/topic to find relevant notes in the vault.

3. If search finds notes that aren't already linked, call `link_notes` to attach them.

4. Call `validate_notes` for the skill ID. This returns:
   - `passed`: whether minimal structural checks passed
   - `issues`: list of problems (if any)
   - `noteContents`: the actual note content for you to review
   - `semanticCheckPrompt`: instructions for your evaluation

5. If structural checks fail, tell the user what's missing. Be specific.

6. If structural checks pass, perform semantic validation per the prompt:
   - Is the content in the user's own words?
   - Does it show genuine comprehension?
   - Are there real sources cited?
   - Can they articulate what they can DO with this knowledge?

7. If everything passes, call `unlock_skill` directly — no need for a separate unlock step.

8. If semantic checks fail, explain what needs improvement. Be encouraging.

### Note

The user's notes can be anywhere in their vault, in any format. Don't judge the structure — judge the understanding.
