import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { createSkill, checkSkill, listSkills, startLearning, unlockSkill, linkNotes } from "./skills.js";
import { dropTemplate } from "./templates.js";
import { validateNotes } from "./validation.js";
import { searchKnowledge, buildIndex } from "./search.js";
import type { SkillStatus } from "./skills.js";

const server = new McpServer({
  name: "deeplearn",
  version: "0.2.0",
});

// --- Tools ---

server.tool(
  "check_skill",
  "Check if a skill exists and its current status (locked/learning/unlocked)",
  {
    skill_id: z.string().describe("The skill ID to check (e.g., 'nix-flakes', 'react-hooks')"),
  },
  async ({ skill_id }) => {
    const result = await checkSkill(skill_id);
    return {
      content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }],
    };
  }
);

server.tool(
  "list_skills",
  "List all registered skills, optionally filtered by status",
  {
    status: z
      .enum(["locked", "learning", "unlocked"])
      .optional()
      .describe("Filter by status. Omit to list all skills."),
  },
  async ({ status }) => {
    const skills = await listSkills(status as SkillStatus | undefined);
    const grouped = {
      total: skills.length,
      locked: skills.filter((s) => s.status === "locked"),
      learning: skills.filter((s) => s.status === "learning"),
      unlocked: skills.filter((s) => s.status === "unlocked"),
    };
    return {
      content: [{ type: "text" as const, text: JSON.stringify(grouped, null, 2) }],
    };
  }
);

server.tool(
  "create_skill",
  "Register a new skill to learn. Creates a JSON skill pointer in .deeplearn/skills/ and transitions it to 'learning' status.",
  {
    id: z
      .string()
      .regex(/^[a-z0-9-]+$/, "Skill ID must be lowercase alphanumeric with hyphens")
      .describe("Unique skill ID (e.g., 'nix-flakes')"),
    name: z.string().describe("Human-readable skill name (e.g., 'Nix Flakes')"),
    category: z.string().describe("Category for grouping (e.g., 'nix', 'react', 'typescript')"),
    documentation: z
      .array(
        z.object({
          url: z.string().url(),
          label: z.string(),
        })
      )
      .optional()
      .describe("Documentation links for the user to read"),
    prerequisites: z
      .array(z.string())
      .optional()
      .describe("Skill IDs that must be unlocked before this one"),
  },
  async ({ id, name, category, documentation, prerequisites }) => {
    const skill = await createSkill({ id, name, category, documentation, prerequisites });

    // Auto-transition to learning
    if (skill.status === "locked") {
      const transition = await startLearning(id);
      if (transition.success && transition.skill) {
        // Drop optional template at vault root
        const tmpl = await dropTemplate(transition.skill);

        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(
                {
                  created: true,
                  skill: transition.skill,
                  template: {
                    path: tmpl.templatePath,
                    alreadyExists: tmpl.alreadyExists,
                  },
                  message: `Skill '${name}' created. Optional template at '${tmpl.templatePath}' — use it, move it, or ignore it. Write notes however you like; we'll search your vault when you're ready.`,
                },
                null,
                2
              ),
            },
          ],
        };
      }
    }

    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify(
            {
              created: false,
              skill,
              message: `Skill '${name}' already exists with status '${skill.status}'.`,
            },
            null,
            2
          ),
        },
      ],
    };
  }
);

server.tool(
  "search_knowledge",
  "Search the user's Obsidian vault for notes related to a topic. Returns matching notes with content for evaluation. Use this to check if the user already has knowledge before creating a locked skill.",
  {
    query: z.string().describe("Topic to search for (e.g., 'nix flakes', 'react hooks')"),
    limit: z.number().optional().default(5).describe("Max results to return (default 5)"),
  },
  async ({ query, limit }) => {
    const result = await searchKnowledge(query, limit);
    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify(
            {
              query,
              totalVaultNotes: result.totalNotes,
              indexAge: result.indexAge,
              matchCount: result.results.length,
              results: result.results.map((r) => ({
                path: r.path,
                title: r.title,
                score: r.score,
                tags: r.tags,
                wordCount: r.wordCount,
                content: r.content,
              })),
            },
            null,
            2
          ),
        },
      ],
    };
  }
);

server.tool(
  "index_vault",
  "Force a full reindex of the Obsidian vault. Use if the user says they added new notes or the search results seem stale.",
  {},
  async () => {
    const index = await buildIndex();
    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify(
            {
              indexed: index.notes.length,
              built: index.built,
              message: `Indexed ${index.notes.length} notes.`,
            },
            null,
            2
          ),
        },
      ],
    };
  }
);

server.tool(
  "link_notes",
  "Link vault notes to a skill as evidence of understanding. Accepts vault-relative paths.",
  {
    skill_id: z.string().describe("The skill ID to link notes to"),
    note_paths: z.array(z.string()).describe("Vault-relative paths to notes (e.g., ['devops/nix-notes.md'])"),
  },
  async ({ skill_id, note_paths }) => {
    const result = await linkNotes(skill_id, note_paths);
    return {
      content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }],
    };
  }
);

server.tool(
  "validate_notes",
  "Validate the user's linked notes for a skill. Returns structural check results and note content for semantic review by Claude.",
  {
    skill_id: z.string().describe("The skill ID whose linked notes to validate"),
  },
  async ({ skill_id }) => {
    const result = await validateNotes(skill_id);
    return {
      content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }],
    };
  }
);

server.tool(
  "unlock_skill",
  "Transition a skill from 'learning' to 'unlocked'. Only call after notes have been validated.",
  {
    skill_id: z.string().describe("The skill ID to unlock"),
  },
  async ({ skill_id }) => {
    const result = await unlockSkill(skill_id);
    return {
      content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }],
    };
  }
);

// --- Start ---

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((err) => {
  console.error("DeepLearn MCP server failed to start:", err);
  process.exit(1);
});
