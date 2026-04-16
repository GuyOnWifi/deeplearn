# DeepLearn

Anti-vibe-coding plugin for Claude Code. Gates AI assistance behind demonstrated understanding — you have to learn a concept before Claude will implement it for you.

Searches your Obsidian vault (or any markdown folder) to find existing knowledge. Write notes however you want, wherever you want — DeepLearn finds them.

## Install

```bash
claude plugin install deeplearn
```

You'll be prompted to set your vault path during setup.

## Local Development

### 1. Build the server

```bash
cd server && npm install && npm run build && cd ..
```

### 2. Run with `--plugin-dir`

```bash
claude --plugin-dir /path/to/deeplearn
```

This loads the plugin for the session — skills, hooks, MCP server, and agents all resolve automatically. Template variables like `${CLAUDE_PLUGIN_ROOT}` and `${user_config.vault_path}` are handled by the plugin framework.

You'll be prompted to set your vault path on first run (same as a normal install).

### 3. Iterate

After editing source files, rebuild and reload without restarting:

```bash
cd server && npm run build
```

Then inside Claude Code:

```
/reload-plugins
```

Or use watch mode for continuous rebuilds:

```bash
cd server && npm run dev
```

### 4. Debug

```bash
claude --debug --plugin-dir /path/to/deeplearn
```

Shows plugin loading details, MCP connection status, and variable resolution.

## How it works

DeepLearn tracks **skills** — concepts at the granularity of "something you could write a focused tutorial about" (e.g., `react-hooks`, `nix-flakes`, not `react` or `useState`).

Each skill has a status:

| Status | What it means | What Claude does |
|---|---|---|
| **locked** | Not started | Refuses to implement, points you to docs |
| **learning** | Notes in progress | Encourages you to finish |
| **unlocked** | You demonstrated understanding | Implements freely |

### Vault search

DeepLearn indexes your entire vault — titles, headings, tags, wiki-links, folder paths. When a skill comes up, it searches for existing notes that demonstrate your knowledge.

**You don't need to write notes in a specific place or format.** If you already have notes about Nix flakes scattered across your vault, DeepLearn finds them. You can optionally tag notes with `#deeplearn/nix-flakes` to explicitly link them to a skill, but it's not required.

### What DeepLearn stores

All plugin data lives in `.deeplearn/` inside your vault:

```
your-vault/
├── .deeplearn/              # Plugin data (hidden in Obsidian)
│   ├── skills/              # JSON skill pointers
│   │   └── nix-flakes.json  # Status, linked notes, docs
│   ├── designs/             # JSON design session pointers
│   │   └── todo-app.json    # Status, path to DESIGN.md
│   └── index.json           # Search index cache
├── DESIGN.md                # Finalized design doc (output of /deeplearn:design)
├── Nix Flakes - Learning.md # Optional template (dropped at root)
├── ... your existing notes ...
```

DeepLearn reads everything in your vault but only writes to `.deeplearn/` and optional templates at the root. Your existing notes are never modified.

## Commands

### `/deeplearn:learn <topic>`

Start learning a new skill. Searches your vault first — if you already have strong notes, it auto-unlocks. Otherwise, creates a skill entry, provides documentation links, and drops an optional template at your vault root.

```
/deeplearn:learn nix-flakes
```

The template is a suggestion. Use it, move it, rename it, or delete it and write notes your own way.

### `/deeplearn:check [topic]`

Check your skill inventory. Shows which skills are unlocked, in progress, or locked.

```
/deeplearn:check
/deeplearn:check nix-flakes
```

### `/deeplearn:submit <skill-id>`

Submit for validation. Searches your vault for relevant notes, links them to the skill, and validates. Structural checks are minimal (enough substance, at least one source URL). Claude performs semantic review — do you actually understand this?

Auto-unlocks on successful validation.

```
/deeplearn:submit nix-flakes
```

### `/deeplearn:unlock <skill-id>`

Manually unlock a skill if you want to bypass the submit flow.

```
/deeplearn:unlock nix-flakes
```

### `/deeplearn:design <project-idea>`

Start a Socratic design session. The AI asks you questions to help you think through your project — it never suggests solutions, architectures, or technologies. Every design decision is yours.

```
/deeplearn:design todo-app
```

The AI walks you through six phases of questioning (Problem, Users & Scope, Concepts, Behaviors, Architecture, Tradeoffs), one question at a time. When you've articulated enough, it formalizes your own words into a structured `DESIGN.md` and writes it to your vault.

The AI will:
- Push for specificity ("what do you mean by 'scalable'?")
- Surface contradictions ("you said X earlier, but now Y")
- Expose assumptions ("you're assuming X — is that true?")
- Find missing pieces ("you haven't mentioned error handling")

The AI will NOT:
- Suggest solutions or technologies
- Propose architectures
- Generate design content you haven't expressed

## The learning flow

1. You ask Claude to build something involving a concept you haven't learned
2. Claude searches your vault for existing knowledge on that concept
3. **If you already have good notes**: skill is auto-created as unlocked — no friction
4. **If notes are thin or missing**: Claude creates a locked skill, points you to docs, and suggests `/deeplearn:learn <topic>`
5. You read the actual docs and write notes however you like, wherever you like
6. You run `/deeplearn:submit <skill-id>` — Claude finds your notes, validates them, and unlocks
7. Claude implements freely with that concept

## Validation

### Structural (automated, minimal)

- At least one linked note exists with real content
- Combined notes have enough substance (50+ words)
- At least one source URL cited somewhere

### Semantic (Claude reviews)

- Content is in your own words, not copy-pasted
- Shows genuine comprehension of the topic
- Can articulate what you can DO with this knowledge
- Sources look like real URLs you actually read

## Anti-vibe-debugging

Even for unlocked skills, if you paste an error without analysis, Claude will ask:

1. What do you think this error means?
2. Which part seems most relevant?
3. What have you tried?

Understanding errors is part of learning.

## Configuration

One config value — your vault path — set during plugin installation.

The vault can be an Obsidian vault, a Logseq directory, or any folder of markdown files. DeepLearn reads `.md` files and ignores `.obsidian/`, `.git/`, `node_modules/`, and hidden directories.

## Project Structure

```
deeplearn/
├── .claude-plugin/plugin.json   # Plugin manifest
├── .mcp.json                    # MCP config (plugin distribution)
├── skills/                      # Slash command definitions
│   ├── learn/SKILL.md           # /deeplearn:learn
│   ├── check/SKILL.md           # /deeplearn:check
│   ├── submit/SKILL.md          # /deeplearn:submit
│   ├── unlock/SKILL.md          # /deeplearn:unlock
│   └── design/SKILL.md          # /deeplearn:design
├── hooks/hooks.json             # UserPromptSubmit hook
├── agents/gatekeeper.md         # Background locked-skill detection
├── bin/check-skills             # Hook script
└── server/                      # MCP server (TypeScript)
    └── src/
        ├── index.ts             # Tool definitions
        ├── vault.ts             # File I/O
        ├── skills.ts            # Skill CRUD + state machine
        ├── designs.ts           # Design session CRUD
        ├── search.ts            # Vault indexer + search
        ├── validation.ts        # Note validation
        └── templates.ts         # Template generation
```
