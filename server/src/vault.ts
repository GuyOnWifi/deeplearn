import fs from "node:fs/promises";
import path from "node:path";

export function getVaultPath(): string {
  const vaultPath = process.env.DEEPLEARN_VAULT_PATH;
  if (!vaultPath) {
    throw new Error(
      "DEEPLEARN_VAULT_PATH is not set. Configure your Obsidian vault path in the plugin settings."
    );
  }
  return vaultPath;
}

/** .deeplearn/ directory inside the vault — all plugin data lives here */
export function deeplearnDir(): string {
  return path.join(getVaultPath(), ".deeplearn");
}

/** .deeplearn/skills/ — JSON skill pointer files */
export function skillsDir(): string {
  return path.join(deeplearnDir(), "skills");
}

/** .deeplearn/index.json — search index cache */
export function indexPath(): string {
  return path.join(deeplearnDir(), "index.json");
}

export async function ensureDirectories(): Promise<void> {
  await fs.mkdir(skillsDir(), { recursive: true });
}

// --- Skill pointer files (JSON) ---

export async function readSkillFile<T>(skillId: string): Promise<T> {
  const filePath = path.join(skillsDir(), `${skillId}.json`);
  const raw = await fs.readFile(filePath, "utf-8");
  return JSON.parse(raw) as T;
}

export async function writeSkillFile<T>(skillId: string, data: T): Promise<void> {
  await ensureDirectories();
  const filePath = path.join(skillsDir(), `${skillId}.json`);
  await fs.writeFile(filePath, JSON.stringify(data, null, 2), "utf-8");
}

export async function listSkillFiles(): Promise<string[]> {
  const dir = skillsDir();
  try {
    const entries = await fs.readdir(dir);
    return entries
      .filter((e) => e.endsWith(".json"))
      .map((e) => e.replace(/\.json$/, ""));
  } catch {
    return [];
  }
}

export async function skillFileExists(skillId: string): Promise<boolean> {
  const filePath = path.join(skillsDir(), `${skillId}.json`);
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

// --- Reading arbitrary vault notes ---

export async function readVaultFile(relativePath: string): Promise<string> {
  const filePath = path.join(getVaultPath(), relativePath);
  return fs.readFile(filePath, "utf-8");
}

export async function writeVaultFile(relativePath: string, content: string): Promise<void> {
  const filePath = path.join(getVaultPath(), relativePath);
  await fs.writeFile(filePath, content, "utf-8");
}

export async function vaultFileExists(relativePath: string): Promise<boolean> {
  const filePath = path.join(getVaultPath(), relativePath);
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}
