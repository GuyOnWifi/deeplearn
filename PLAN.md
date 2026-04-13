# DeepLearn — Anti-Vibe-Coding Plugin for Claude Code

## Context

Vibe coding (asking AI to implement things you don't understand) is detrimental to learning. Reading AI output isn't learning — it's copying homework. DeepLearn enforces a "learn before you implement" protocol by searching your existing notes for demonstrated understanding and gating AI assistance accordingly.

**Distribution**: Claude Code plugin, installable from the Anthropic marketplace.

## Architecture Overview

Three integration points, all bundled as a single Claude Code plugin:

1. **Skills** — User-facing slash commands (`/deeplearn:learn`, `/deeplearn:check`, `/deeplearn:submit`, `/deeplearn:unlock`) that guide the learning workflow.
2. **Hooks** — `UserPromptSubmit` hook reads skill state from `.deeplearn/skills/` and injects locked/unlocked context on every turn.
3. **MCP Server** (TypeScript/Node) — provides tools for vault search, skill management, note linking, and validation.

**Key principle**: Read everything, write nothing (to user's notes). Plugin data lives in `.deeplearn/` inside the vault. The user's existing notes are never modified.

## Plugin Structure

```
deeplearn/
├── .claude-plugin/
│   └── plugin.json                # Plugin manifest
├── skills/
│   ├── learn/
│   │   └── SKILL.md               # /deeplearn:learn <topic>
│   ├── check/
│   │   └── SKILL.md               # /deeplearn:check [topic]
│   ├── submit/
│   │   └── SKILL.md               # /deeplearn:submit <skill-id>
│   └── unlock/
│       └── SKILL.md               # /deeplearn:unlock <skill-id>
├── agents/
│   └── gatekeeper.md              # Background agent: auto-detects locked skill usage
├── hooks/
│   └── hooks.json                 # UserPromptSubmit hook (auto-loaded by convention)
├── .mcp.json                      # MCP server config (auto-loaded by convention)
├── server/
│   ├── package.json
│   ├── tsconfig.json
│   └── src/
│       ├── index.ts               # MCP server entry, tool definitions
│       ├── vault.ts               # Vault filesystem operations
│       ├── skills.ts              # Skill state management (JSON pointers)
│       ├── search.ts              # Vault indexer + keyword search
│       ├── validation.ts          # Content-based note validation
│       └── templates.ts           # Optional template generation
├── bin/
│   └── check-skills               # Hook script: reads .deeplearn/skills/*.json
├── PLAN.md
├── TODO.md
└── README.md
```

## Vault Data Model

All plugin data lives in `.deeplearn/` inside the user's vault:

```
vault/
├── .deeplearn/
│   ├── skills/
│   │   └── nix-flakes.json        # Skill pointer (JSON)
│   └── index.json                 # Search index cache
├── ... user's existing notes ...
```

### Skill Pointers (`.deeplearn/skills/<id>.json`)

Lightweight JSON files that track status and point to notes:

```json
{
  "id": "nix-flakes",
  "name": "Nix Flakes",
  "category": "nix",
  "status": "learning",
  "created": "2026-04-13",
  "unlocked_at": null,
  "documentation": [
    { "url": "https://nixos.wiki/wiki/Flakes", "label": "Nix Wiki" }
  ],
  "prerequisites": [],
  "linked_notes": [
    "devops/nix/flakes-deep-dive.md",
    "daily/2026-04-12.md"
  ]
}
```

State machine: `locked` → `learning` → `unlocked` (also `locked` → `unlocked` for auto-detected knowledge)

### Search Index (`.deeplearn/index.json`)

Cached index of all `.md` files in the vault. Per-file metadata:
- Title (first H1 or filename)
- Headings (H2/H3)
- Tags (frontmatter + inline `#tags`)
- Wiki-links (`[[links]]`)
- Word count
- Content hash (for staleness detection)

Auto-refreshes if older than 5 minutes. Force refresh with `index_vault` tool.

## MCP Tools

| Tool | Purpose |
|---|---|
| `check_skill` | Check if a skill exists and its status |
| `list_skills` | List all skills, optionally filtered by status |
| `create_skill` | Register a new skill (auto-transitions to learning, drops optional template) |
| `search_knowledge` | Search the vault for notes related to a topic |
| `index_vault` | Force a full vault reindex |
| `link_notes` | Link vault notes to a skill as evidence |
| `validate_notes` | Validate linked notes (minimal structural + semantic prompt for Claude) |
| `unlock_skill` | Transition a skill to unlocked |

## Search & Scoring

The indexer walks all `.md` files, skipping `.obsidian/`, `.git/`, `.deeplearn/`, `node_modules/`, and hidden directories.

Keyword search scoring:
- Explicit `#deeplearn/<skill>` tag: **+20**
- Title match: **+10** (bonus +5 for exact match)
- Tag match: **+8**
- Heading match: **+5**
- Folder path match: **+4**
- Wiki-link match: **+3**
- Long note bonus: **+2** (>200 words), **+2** (>500 words)

## Validation

**Structural checks** (minimal, in MCP server):
- At least one linked note exists and is readable
- Combined content is substantial (50+ words)
- At least one source URL cited

**Semantic checks** (delegated to Claude):
- Content is in the user's own words
- Demonstrates genuine comprehension
- Can articulate concrete outputs
- Sources are real

## Key Design Decisions

- **Read everything, write nothing** — the plugin reads existing notes to find knowledge but never modifies user files. All plugin data is in `.deeplearn/`.
- **Skills are pointers, not content** — JSON files that track status and point to notes. Notes can live anywhere in the vault, in any format.
- **Search-first** — before creating a locked skill, search the vault. If the user already has good notes, auto-unlock. No unnecessary friction.
- **Optional templates** — `/deeplearn:learn` drops a template at the vault root as a suggestion. Users can use it, move it, or ignore it.
- **Minimal structural validation** — the MCP server checks bare minimums (content exists, has substance, cites a source). Claude handles semantic judgment.
- **No `PreToolUse` gate** — system prompt injection via hook is sufficient and much cheaper than intercepting every tool call.
- **Hooks and MCP auto-load by convention** — `hooks/hooks.json` and `.mcp.json` at plugin root are picked up automatically. The manifest only declares `skills`.
