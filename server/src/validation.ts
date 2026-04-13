import { readVaultFile, vaultFileExists } from "./vault.js";
import { readSkillFile } from "./vault.js";
import type { SkillPointer } from "./skills.js";

const URL_REGEX = /https?:\/\/[^\s)>\]]+/g;

interface ValidationResult {
  skillId: string;
  passed: boolean;
  issues: string[];
  /** Content of all linked notes for Claude to evaluate */
  noteContents: Array<{ path: string; content: string }>;
  /** Instructions for Claude's semantic review */
  semanticCheckPrompt: string;
}

function stripFrontmatterAndComments(content: string): string {
  let stripped = content.replace(/^---\n[\s\S]*?\n---\n?/, "");
  stripped = stripped.replace(/<!--[\s\S]*?-->/g, "");
  return stripped.trim();
}

function countWords(text: string): number {
  return text.split(/\s+/).filter((w) => w.length > 0).length;
}

function countUrls(text: string): number {
  const matches = text.match(URL_REGEX);
  return matches ? matches.length : 0;
}

/**
 * Validates the user's linked notes for a skill.
 *
 * Structural checks are minimal and forgiving:
 * - At least one linked note exists and is readable
 * - Combined content has enough substance (not a stub)
 * - At least one real URL cited somewhere
 *
 * The heavy lifting is semantic — Claude evaluates the returned content.
 */
export async function validateNotes(skillId: string): Promise<ValidationResult> {
  let skill: SkillPointer;
  try {
    skill = await readSkillFile<SkillPointer>(skillId);
  } catch {
    return {
      skillId,
      passed: false,
      issues: [`Skill '${skillId}' does not exist.`],
      noteContents: [],
      semanticCheckPrompt: "",
    };
  }

  if (skill.linked_notes.length === 0) {
    return {
      skillId,
      passed: false,
      issues: [
        "No notes linked to this skill yet.",
        "Either write notes and link them, or run a search to auto-discover existing notes.",
      ],
      noteContents: [],
      semanticCheckPrompt: "",
    };
  }

  const issues: string[] = [];
  const noteContents: Array<{ path: string; content: string }> = [];
  let totalWords = 0;
  let totalUrls = 0;

  for (const notePath of skill.linked_notes) {
    if (!(await vaultFileExists(notePath))) {
      issues.push(`Linked note '${notePath}' not found in vault.`);
      continue;
    }

    try {
      const raw = await readVaultFile(notePath);
      const stripped = stripFrontmatterAndComments(raw);
      const words = countWords(stripped);
      const urls = countUrls(stripped);

      totalWords += words;
      totalUrls += urls;
      noteContents.push({ path: notePath, content: raw });
    } catch {
      issues.push(`Could not read '${notePath}'.`);
    }
  }

  if (noteContents.length === 0) {
    issues.push("None of the linked notes could be read.");
    return { skillId, passed: false, issues, noteContents, semanticCheckPrompt: "" };
  }

  // Minimal structural checks — just ensuring there's real substance
  if (totalWords < 50) {
    issues.push(
      `Combined notes are very short (${totalWords} words). Write more to demonstrate understanding.`
    );
  }

  if (totalUrls < 1) {
    issues.push(
      "No source URLs found in any linked note. Cite at least one resource you actually read."
    );
  }

  const passed = issues.length === 0;

  const semanticCheckPrompt = passed
    ? [
        `Structural checks PASSED for skill '${skill.name}'. Now review the note content below.`,
        "",
        "Evaluate whether this person understands the concept. Check:",
        "1. Do they explain it in their own words (not copy-pasted from docs)?",
        "2. Is there evidence they actually read sources (specific details, not just summaries)?",
        "3. Can they articulate what they can DO with this knowledge?",
        "4. Is the depth appropriate for the concept?",
        "",
        `If they demonstrate understanding, unlock the skill with unlock_skill('${skillId}').`,
        "If not, explain specifically what's missing — be encouraging, not gatekeeping.",
      ].join("\n")
    : "";

  return { skillId, passed, issues, noteContents, semanticCheckPrompt };
}
