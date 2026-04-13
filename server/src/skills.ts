import {
  ensureDirectories,
  readSkillFile,
  writeSkillFile,
  listSkillFiles,
  skillFileExists,
} from "./vault.js";

export type SkillStatus = "locked" | "learning" | "unlocked";

/** JSON skill pointer — lives at .deeplearn/skills/<id>.json */
export interface SkillPointer {
  id: string;
  name: string;
  category: string;
  status: SkillStatus;
  created: string;
  unlocked_at: string | null;
  documentation: Array<{ url: string; label: string }>;
  prerequisites: string[];
  /** Vault-relative paths to notes the user linked or search discovered */
  linked_notes: string[];
}

export interface SkillSummary {
  id: string;
  name: string;
  category: string;
  status: SkillStatus;
  documentation: Array<{ url: string; label: string }>;
  prerequisites: string[];
  linked_notes: string[];
}

function toISODate(date: Date): string {
  return date.toISOString().split("T")[0];
}

export async function createSkill(params: {
  id: string;
  name: string;
  category: string;
  documentation?: Array<{ url: string; label: string }>;
  prerequisites?: string[];
}): Promise<SkillPointer> {
  await ensureDirectories();

  if (await skillFileExists(params.id)) {
    return readSkillFile<SkillPointer>(params.id);
  }

  const skill: SkillPointer = {
    id: params.id,
    name: params.name,
    category: params.category,
    status: "locked",
    created: toISODate(new Date()),
    unlocked_at: null,
    documentation: params.documentation ?? [],
    prerequisites: params.prerequisites ?? [],
    linked_notes: [],
  };

  await writeSkillFile(params.id, skill);
  return skill;
}

export async function checkSkill(
  skillId: string
): Promise<{ exists: boolean; skill?: SkillSummary }> {
  if (!(await skillFileExists(skillId))) {
    return { exists: false };
  }

  const skill = await readSkillFile<SkillPointer>(skillId);
  return {
    exists: true,
    skill: {
      id: skill.id,
      name: skill.name,
      category: skill.category,
      status: skill.status,
      documentation: skill.documentation,
      prerequisites: skill.prerequisites,
      linked_notes: skill.linked_notes,
    },
  };
}

export async function listSkills(
  statusFilter?: SkillStatus
): Promise<SkillSummary[]> {
  await ensureDirectories();
  const ids = await listSkillFiles();
  const skills: SkillSummary[] = [];

  for (const id of ids) {
    const skill = await readSkillFile<SkillPointer>(id);
    if (statusFilter && skill.status !== statusFilter) continue;
    skills.push({
      id: skill.id,
      name: skill.name,
      category: skill.category,
      status: skill.status,
      documentation: skill.documentation,
      prerequisites: skill.prerequisites,
      linked_notes: skill.linked_notes,
    });
  }

  return skills;
}

export async function linkNotes(
  skillId: string,
  notePaths: string[]
): Promise<{ success: boolean; error?: string; skill?: SkillPointer }> {
  if (!(await skillFileExists(skillId))) {
    return { success: false, error: `Skill '${skillId}' does not exist.` };
  }

  const skill = await readSkillFile<SkillPointer>(skillId);
  const existing = new Set(skill.linked_notes);
  for (const p of notePaths) {
    existing.add(p);
  }
  skill.linked_notes = [...existing];
  await writeSkillFile(skillId, skill);
  return { success: true, skill };
}

export async function transitionSkill(
  skillId: string,
  targetStatus: SkillStatus
): Promise<{ success: boolean; error?: string; skill?: SkillPointer }> {
  if (!(await skillFileExists(skillId))) {
    return { success: false, error: `Skill '${skillId}' does not exist.` };
  }

  const skill = await readSkillFile<SkillPointer>(skillId);
  const current = skill.status;

  const validTransitions: Record<SkillStatus, SkillStatus[]> = {
    locked: ["learning", "unlocked"],
    learning: ["unlocked"],
    unlocked: [],
  };

  if (!validTransitions[current].includes(targetStatus)) {
    return {
      success: false,
      error: `Cannot transition from '${current}' to '${targetStatus}'. Valid transitions from '${current}': ${validTransitions[current].join(", ") || "none"}.`,
    };
  }

  skill.status = targetStatus;
  if (targetStatus === "unlocked") {
    skill.unlocked_at = toISODate(new Date());
  }

  await writeSkillFile(skillId, skill);
  return { success: true, skill };
}

export async function startLearning(
  skillId: string
): Promise<{ success: boolean; error?: string; skill?: SkillPointer }> {
  return transitionSkill(skillId, "learning");
}

export async function unlockSkill(
  skillId: string
): Promise<{ success: boolean; error?: string; skill?: SkillPointer }> {
  return transitionSkill(skillId, "unlocked");
}
