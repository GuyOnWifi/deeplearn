import { vaultFileExists, writeVaultFile } from "./vault.js";
import type { SkillPointer } from "./skills.js";

/**
 * Drops an optional learning template at the vault root.
 * User can fill it in, move it, rename it, or delete it entirely.
 * The search indexer will find it (or any other note) regardless of location.
 */
export async function dropTemplate(
  skill: SkillPointer
): Promise<{ templatePath: string; alreadyExists: boolean; template: string }> {
  const fileName = `${skill.name} - Learning.md`;
  const exists = await vaultFileExists(fileName);

  const docLinks = skill.documentation
    .map((d) => `- [${d.label}](${d.url})`)
    .join("\n");

  const prereqs = skill.prerequisites.length > 0
    ? skill.prerequisites.map((p) => `- [[${p}]]`).join("\n")
    : "";

  const template = `# ${skill.name}

${skill.prerequisites.length > 0 ? `## Prerequisites\n\n${prereqs}\n\n` : ""}## Sources

${docLinks ? `${docLinks}\n\n` : ""}<!-- Add URLs you actually read here -->

## What is it?

<!-- In your own words — what is this, why does it exist? -->

## How it works

<!-- Key mechanisms, mental model, what happens under the hood -->

## What I can do with it

<!-- Concrete things you can now build or do -->
<!-- Be specific: "write a flake.nix that pins nixpkgs" not "I understand flakes" -->

## Gotchas

<!-- Surprises, edge cases, things that tripped you up -->

## See also

<!-- [[links]] to related notes in your vault -->
`;

  if (!exists) {
    await writeVaultFile(fileName, template);
  }

  return { templatePath: fileName, alreadyExists: exists, template };
}
