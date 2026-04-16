# TODO

## Bugs

- [ ] `startLearning` does not enforce prerequisite chains — users can start learning a skill without unlocking its prerequisites

## Must-Have (Ship Blockers)

- [ ] **Escape hatch** — Add `/deeplearn:override <reason>` that lets users bypass gating with a logged justification. Consider a budget of N overrides per week to prevent abuse while allowing legitimate urgency.
- [ ] **Auto-detection of unregistered concepts** — The hook now instructs Claude to search the vault when it encounters an unregistered concept, but this relies on Claude's judgment. Consider adding heuristics to the hook script or a lightweight concept taxonomy.
- [ ] **Enforce prerequisites** — `startLearning` should check that all prerequisite skills are unlocked before allowing the transition. Show the dependency chain when blocked.

## Design Feature

- [ ] **Design session resumption** — When a user returns to an `exploring` design, reconstruct context from conversation history or persist question/answer pairs in the session JSON.
- [ ] **Design-to-skill bridge** — When a finalized DESIGN.md references technologies, auto-check whether skills exist and suggest `/deeplearn:learn` for missing ones before implementation begins.
- [ ] **Design review skill** — `/deeplearn:design-review` that reads an existing DESIGN.md and asks Socratic questions about gaps, contradictions, or vague sections.
- [ ] **Multiple design docs** — Support designs for sub-systems that reference each other (e.g., `DESIGN-auth.md`, `DESIGN-api.md`).
- [ ] **Design versioning** — Track revisions when a user revisits a completed design. Store previous versions in `.deeplearn/designs/<id>/v1.md`, etc.

## High-Value (Next Iteration)

- [ ] **Graduated debugging tiers** — Replace all-or-nothing Socratic debugging with tiers based on error complexity:
  - Tier 1 (simple: typo, missing import): Point it out, ask "Does this make sense?"
  - Tier 2 (moderate): One focused question, then help
  - Tier 3 (complex/conceptual): Full Socratic flow
- [ ] **Skill tiers** — Not all concepts need the same depth of validation:
  - Micro (CSS property, CLI flag): Quick in-conversation verification
  - Standard (React hooks, async/await): Current note-based flow
  - Deep (Nix flakes, distributed systems): Higher substance threshold
- [ ] **Dashboard note** — Auto-generate `.deeplearn/dashboard.md` with: skill counts by status, learning streak, prerequisite tree (Mermaid diagram).
- [ ] **Teach-back validation** — After note submission, Claude asks 2-3 questions about the concept in conversation as an additional signal.
- [ ] **Skill decay / spaced repetition** — Track `last_used_at` per skill. After N days of non-use, transition to "rusty" state with a lighter review requirement.
- [ ] **Incremental index updates** — Currently rebuilds the full index when stale. Use content hashes and mtimes to only reparse changed files.

## Differentiating (Makes It Compelling)

- [ ] **XP and levels** — Award XP for completing notes, using skills in real code, reviewing rusty skills, maintaining streaks.
- [ ] **Badges** — "First Derivation", "Polyglot" (5+ categories), "Deep Diver", "No Vibes" (full week without override), "Debugger" (10 self-diagnosed errors).
- [ ] **Anki flashcard generation** — Auto-extract flashcards from notes after unlock. Export via AnkiConnect API or `.apkg` file.
- [ ] **Community skill packs** — Pre-built prerequisite chains for common stacks (e.g., "Nix Ecosystem", "React Fundamentals"). Installable as plugin dependencies.
- [ ] **Living notes** — After unlock, Claude writes back insights and gotchas discovered during implementation to the linked notes (opt-in, since the default is read-only).

## Edge Cases to Address

- [ ] Multi-concept requests — Handle partial blocking when a request touches both locked and unlocked skills.
- [ ] Skill boundary ambiguity — Guide Claude toward the right granularity (not too broad like "React", not too fine like "useState").
- [ ] Team/shared vaults — Namespace skill states by user if multiple devs share a vault.
- [ ] Offline/disconnected vault — Graceful degradation if vault path is unreachable.
- [ ] Skill versioning — Mark skills as outdated when the technology changes significantly.
- [ ] Hook performance — `bin/check-skills` reads every JSON skill file on every prompt. Optimize for 50+ skills (consider a single manifest file).
- [ ] Large vaults — Index performance for vaults with 1000+ notes. Consider streaming or chunked indexing.
