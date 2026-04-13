import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import { getVaultPath, indexPath, readVaultFile } from "./vault.js";

// --- Types ---

export interface NoteMetadata {
  /** Vault-relative path */
  path: string;
  /** First H1 heading or filename */
  title: string;
  /** H2/H3 headings */
  headings: string[];
  /** Frontmatter tags + inline #tags */
  tags: string[];
  /** [[wiki-links]] */
  links: string[];
  /** Total word count (excluding frontmatter/comments) */
  wordCount: number;
  /** MD5 of content for staleness detection */
  contentHash: string;
  /** File mtime (ms) for quick change detection */
  modified: number;
}

export interface SearchIndex {
  version: 1;
  built: string;
  notes: NoteMetadata[];
}

export interface SearchResult {
  path: string;
  title: string;
  score: number;
  tags: string[];
  headings: string[];
  wordCount: number;
}

// --- Parsing ---

function extractTitle(content: string, fileName: string): string {
  const match = content.match(/^#\s+(.+)$/m);
  return match ? match[1].trim() : fileName.replace(/\.md$/, "");
}

function extractHeadings(content: string): string[] {
  const headings: string[] = [];
  for (const match of content.matchAll(/^#{2,3}\s+(.+)$/gm)) {
    headings.push(match[1].trim());
  }
  return headings;
}

function extractFrontmatterTags(content: string): string[] {
  const fmMatch = content.match(/^---\n([\s\S]*?)\n---/);
  if (!fmMatch) return [];

  const tags: string[] = [];
  const fm = fmMatch[1];

  // tags: [tag1, tag2] or tags:\n  - tag1\n  - tag2
  const inlineMatch = fm.match(/^tags:\s*\[([^\]]*)\]/m);
  if (inlineMatch) {
    tags.push(
      ...inlineMatch[1]
        .split(",")
        .map((t) => t.trim().replace(/^["']|["']$/g, ""))
        .filter(Boolean)
    );
  }

  const listMatches = fm.matchAll(/^tags:\s*\n((?:\s+-\s+.+\n?)*)/gm);
  for (const m of listMatches) {
    for (const item of m[1].matchAll(/^\s+-\s+(.+)$/gm)) {
      tags.push(item[1].trim().replace(/^["']|["']$/g, ""));
    }
  }

  return tags;
}

function extractInlineTags(content: string): string[] {
  const tags: string[] = [];
  // Match #tag but not inside code blocks, headings, or URLs
  for (const match of content.matchAll(/(?:^|\s)#([a-zA-Z0-9_/.-]+)/g)) {
    const tag = match[1];
    // Skip if it looks like a heading marker or CSS color
    if (/^\d+$/.test(tag)) continue;
    tags.push(tag);
  }
  return tags;
}

function extractLinks(content: string): string[] {
  const links: string[] = [];
  for (const match of content.matchAll(/\[\[([^\]|]+)(?:\|[^\]]*)?\]\]/g)) {
    links.push(match[1].trim());
  }
  return links;
}

function stripFrontmatterAndComments(content: string): string {
  let stripped = content.replace(/^---\n[\s\S]*?\n---\n?/, "");
  stripped = stripped.replace(/<!--[\s\S]*?-->/g, "");
  return stripped;
}

function countWords(content: string): number {
  const stripped = stripFrontmatterAndComments(content);
  const words = stripped.split(/\s+/).filter((w) => w.length > 0);
  return words.length;
}

function hashContent(content: string): string {
  return crypto.createHash("md5").update(content).digest("hex");
}

async function parseNote(vaultPath: string, relativePath: string): Promise<NoteMetadata | null> {
  try {
    const fullPath = path.join(vaultPath, relativePath);
    const stat = await fs.stat(fullPath);
    const content = await fs.readFile(fullPath, "utf-8");
    const fileName = path.basename(relativePath);

    const fmTags = extractFrontmatterTags(content);
    const inlineTags = extractInlineTags(content);
    const allTags = [...new Set([...fmTags, ...inlineTags])];

    return {
      path: relativePath,
      title: extractTitle(content, fileName),
      headings: extractHeadings(content),
      tags: allTags,
      links: extractLinks(content),
      wordCount: countWords(content),
      contentHash: hashContent(content),
      modified: stat.mtimeMs,
    };
  } catch {
    return null;
  }
}

// --- Indexing ---

async function walkMarkdownFiles(dir: string, base: string): Promise<string[]> {
  const results: string[] = [];
  let entries;
  try {
    entries = await fs.readdir(dir, { withFileTypes: true });
  } catch {
    return results;
  }

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    const relativePath = path.relative(base, fullPath);

    // Skip hidden dirs and .deeplearn
    if (entry.name.startsWith(".")) continue;
    // Skip common non-note directories
    if (entry.isDirectory() && ["node_modules", ".git", ".obsidian", ".trash"].includes(entry.name)) continue;

    if (entry.isDirectory()) {
      results.push(...(await walkMarkdownFiles(fullPath, base)));
    } else if (entry.name.endsWith(".md")) {
      results.push(relativePath);
    }
  }

  return results;
}

export async function buildIndex(): Promise<SearchIndex> {
  const vaultPath = getVaultPath();
  const files = await walkMarkdownFiles(vaultPath, vaultPath);
  const notes: NoteMetadata[] = [];

  for (const file of files) {
    const meta = await parseNote(vaultPath, file);
    if (meta && meta.wordCount > 5) {
      notes.push(meta);
    }
  }

  const index: SearchIndex = {
    version: 1,
    built: new Date().toISOString(),
    notes,
  };

  // Cache to .deeplearn/index.json
  const idxPath = indexPath();
  await fs.mkdir(path.dirname(idxPath), { recursive: true });
  await fs.writeFile(idxPath, JSON.stringify(index), "utf-8");

  return index;
}

export async function loadIndex(): Promise<SearchIndex | null> {
  try {
    const raw = await fs.readFile(indexPath(), "utf-8");
    return JSON.parse(raw) as SearchIndex;
  } catch {
    return null;
  }
}

/** Rebuild index if it's older than maxAge ms, or if it doesn't exist */
export async function ensureIndex(maxAgeMs: number = 5 * 60 * 1000): Promise<SearchIndex> {
  const existing = await loadIndex();
  if (existing) {
    const age = Date.now() - new Date(existing.built).getTime();
    if (age < maxAgeMs) return existing;
  }
  return buildIndex();
}

// --- Search ---

function tokenize(query: string): string[] {
  return query
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length > 1);
}

function scoreNote(note: NoteMetadata, tokens: string[]): number {
  let score = 0;
  const titleLower = note.title.toLowerCase();
  const headingsLower = note.headings.map((h) => h.toLowerCase());
  const tagsLower = note.tags.map((t) => t.toLowerCase());
  const linksLower = note.links.map((l) => l.toLowerCase());
  const pathLower = note.path.toLowerCase();

  for (const token of tokens) {
    // Explicit deeplearn tag — strongest signal
    if (tagsLower.some((t) => t === `deeplearn/${token}` || t === `deeplearn-${token}`)) {
      score += 20;
    }

    // Title match
    if (titleLower.includes(token)) {
      score += 10;
      // Bonus for exact title match
      if (titleLower === token || titleLower === tokens.join(" ")) {
        score += 5;
      }
    }

    // Tag match
    if (tagsLower.some((t) => t.includes(token))) {
      score += 8;
    }

    // Heading match
    if (headingsLower.some((h) => h.includes(token))) {
      score += 5;
    }

    // Folder path match
    if (pathLower.includes(token)) {
      score += 4;
    }

    // Wiki-link match
    if (linksLower.some((l) => l.includes(token))) {
      score += 3;
    }
  }

  // Bonus for longer notes (more substance)
  if (note.wordCount > 200) score += 2;
  if (note.wordCount > 500) score += 2;

  return score;
}

export function searchNotes(index: SearchIndex, query: string, limit: number = 10): SearchResult[] {
  const tokens = tokenize(query);
  if (tokens.length === 0) return [];

  const scored: SearchResult[] = [];

  for (const note of index.notes) {
    const score = scoreNote(note, tokens);
    if (score > 0) {
      scored.push({
        path: note.path,
        title: note.title,
        score,
        tags: note.tags,
        headings: note.headings,
        wordCount: note.wordCount,
      });
    }
  }

  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, limit);
}

/**
 * Search the vault for notes relevant to a topic.
 * Returns matches with content for the top results.
 */
export async function searchKnowledge(
  query: string,
  limit: number = 5
): Promise<{
  results: Array<SearchResult & { content: string }>;
  indexAge: string;
  totalNotes: number;
}> {
  const index = await ensureIndex();
  const results = searchNotes(index, query, limit);

  const withContent = await Promise.all(
    results.map(async (r) => {
      try {
        const content = await readVaultFile(r.path);
        return { ...r, content };
      } catch {
        return { ...r, content: "(could not read file)" };
      }
    })
  );

  return {
    results: withContent,
    indexAge: index.built,
    totalNotes: index.notes.length,
  };
}
