import {
  ensureDirectories,
  readDesignFile,
  writeDesignFile,
  listDesignFiles,
  designFileExists,
  writeVaultFile,
  vaultFileExists,
} from "./vault.js";

export type DesignStatus = "exploring" | "complete";

/** JSON design session — lives at .deeplearn/designs/<id>.json */
export interface DesignSession {
  id: string;
  name: string;
  status: DesignStatus;
  created: string;
  completed_at: string | null;
  /** Vault-relative path where the DESIGN.md was written (null until finalized) */
  design_doc_path: string | null;
}

export interface DesignSummary {
  id: string;
  name: string;
  status: DesignStatus;
  created: string;
  completed_at: string | null;
  design_doc_path: string | null;
}

function toISODate(date: Date): string {
  return date.toISOString().split("T")[0];
}

export async function createDesign(params: {
  id: string;
  name: string;
}): Promise<{ created: boolean; design: DesignSession }> {
  await ensureDirectories();

  if (await designFileExists(params.id)) {
    const existing = await readDesignFile<DesignSession>(params.id);
    return { created: false, design: existing };
  }

  const design: DesignSession = {
    id: params.id,
    name: params.name,
    status: "exploring",
    created: toISODate(new Date()),
    completed_at: null,
    design_doc_path: null,
  };

  await writeDesignFile(params.id, design);
  return { created: true, design };
}

export async function getDesign(
  designId: string
): Promise<{ exists: boolean; design?: DesignSummary }> {
  if (!(await designFileExists(designId))) {
    return { exists: false };
  }

  const design = await readDesignFile<DesignSession>(designId);
  return { exists: true, design };
}

export async function listDesigns(
  statusFilter?: DesignStatus
): Promise<DesignSummary[]> {
  await ensureDirectories();
  const ids = await listDesignFiles();
  const designs: DesignSummary[] = [];

  for (const id of ids) {
    const design = await readDesignFile<DesignSession>(id);
    if (statusFilter && design.status !== statusFilter) continue;
    designs.push(design);
  }

  return designs;
}

/**
 * Write the finalized DESIGN.md to the vault and mark the session as complete.
 *
 * The content is authored by the user through Socratic questioning —
 * Claude formalizes the user's own words into the DESIGN.md format.
 */
export async function writeDesignDoc(
  designId: string,
  content: string,
  vaultRelativePath: string
): Promise<{ success: boolean; error?: string; path?: string }> {
  if (!(await designFileExists(designId))) {
    return { success: false, error: `Design session '${designId}' does not exist.` };
  }

  const design = await readDesignFile<DesignSession>(designId);

  // Write the DESIGN.md file
  await writeVaultFile(vaultRelativePath, content);

  // Update session state
  design.status = "complete";
  design.completed_at = toISODate(new Date());
  design.design_doc_path = vaultRelativePath;
  await writeDesignFile(designId, design);

  return { success: true, path: vaultRelativePath };
}
