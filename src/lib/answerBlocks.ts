// Turns a model answer (loose Markdown) into blocks the answer view renders. Hand-written instead of a
// Markdown library because each piece of text still has to go through the citation highlighter.
// Checked by scripts/answer-blocks.check.mjs (run: node scripts/answer-blocks.check.mjs).

export type Item = { text: string; value?: number; children?: ListBlock };
export type ListBlock = { kind: "list"; ordered: boolean; items: Item[] };
export type Block =
  | { kind: "p"; text: string }
  | { kind: "h"; text: string }
  | { kind: "hr" }
  | { kind: "code"; text: string }
  | { kind: "table"; head: string[]; rows: string[][] }
  | ListBlock;

const CITES = /\s*\[\d+(?:,\s*\d+)*\]/g;

/** Fixes the model's habits the renderer can't otherwise handle. */
export function normalize(text: string): string {
  return text
    // \[ … \] and \( … \) are LaTeX delimiters too; the renderer knows $$ … $$ and $ … $.
    .replace(/\\\[([\s\S]+?)\\\]/g, (_, m: string) => `$$${m}$$`)
    .replace(/\\\(([\s\S]+?)\\\)/g, (_, m: string) => `$${m}$`)
    // Display math over several lines becomes one line, so the line parser keeps it whole.
    .replace(/\$\$([\s\S]*?)\$\$/g, (_, m: string) => `$$${m.replace(/\n/g, " ")}$$`)
    // ***bold italic*** shows as bold.
    .replace(/\*\*\*([^*\n]+)\*\*\*/g, "**$1**")
    // A citation inside bold ("**Mitochondria [1]**") would split the bold in two; move it after.
    .replace(/\*\*([^*\n]+)\*\*/g, (whole, inner: string) => {
      const cites = inner.match(CITES);
      return cites ? `**${inner.replace(CITES, "").trim()}**${cites.map((c) => c.trim()).join("")}` : whole;
    });
}

type Line = { indent: number; ordered: boolean; value?: number; text: string };
const HR = /^\s*([-*_])(\s*\1){2,}\s*$/;
const ORDERED = /^(\s*)(\d+)[.)]\s+(.*)$/;
const BULLET = /^(\s*)[-*+]\s+(.*)$/;

function listLine(line: string): Line | null {
  if (HR.test(line)) return null;
  const o = line.match(ORDERED);
  if (o) return { indent: o[1].length, ordered: true, value: Number(o[2]), text: o[3] };
  const b = line.match(BULLET);
  return b ? { indent: b[1].length, ordered: false, text: b[2] } : null;
}

const cells = (line: string) => line.trim().replace(/^\|/, "").replace(/\|$/, "").split("|").map((c) => c.trim());
const isTableRule = (line: string) => /^\s*\|?[\s:|-]+\|?\s*$/.test(line) && line.includes("-");

export function parseAnswer(text: string): Block[] {
  const lines = normalize(text).split("\n");
  const blocks: Block[] = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();
    if (!trimmed) { i++; continue; }

    if (trimmed.startsWith("```")) {
      const code: string[] = [];
      for (i++; i < lines.length && !lines[i].trim().startsWith("```"); i++) code.push(lines[i]);
      blocks.push({ kind: "code", text: code.join("\n") });
      i++; // the closing fence (or past the end)
      continue;
    }
    if (HR.test(line)) { blocks.push({ kind: "hr" }); i++; continue; }
    const heading = trimmed.match(/^#{1,6}\s+(.+?)\s*#*$/);
    if (heading) { blocks.push({ kind: "h", text: heading[1] }); i++; continue; }

    if (trimmed.startsWith("|") && i + 1 < lines.length && isTableRule(lines[i + 1])) {
      const head = cells(line);
      const rows: string[][] = [];
      for (i += 2; i < lines.length && lines[i].trim().startsWith("|"); i++) rows.push(cells(lines[i]));
      blocks.push({ kind: "table", head, rows });
      continue;
    }

    const first = listLine(line);
    if (first) {
      // ponytail: two levels; anything deeper joins the second level.
      const list: ListBlock = { kind: "list", ordered: first.ordered, items: [] };
      while (i < lines.length) {
        const it = listLine(lines[i]);
        const last = list.items[list.items.length - 1];
        if (!it) {
          if (!lines[i].trim()) {
            // A blank line inside a list (between items) keeps the list going, so numbering continues.
            let j = i;
            while (j < lines.length && !lines[j].trim()) j++;
            if (j < lines.length && listLine(lines[j])) { i = j; continue; }
            break;
          }
          // An indented plain line continues the item above it.
          if (last && /^\s{2,}\S/.test(lines[i])) { last.text += ` ${lines[i].trim()}`; i++; continue; }
          break;
        }
        if (it.indent > first.indent && last) {
          last.children ??= { kind: "list", ordered: it.ordered, items: [] };
          last.children.items.push({ text: it.text, value: it.value });
        } else if (it.ordered !== list.ordered) {
          break; // a top-level list of the other kind starts its own block
        } else {
          list.items.push({ text: it.text, value: it.value });
        }
        i++;
      }
      blocks.push(list);
      continue;
    }

    blocks.push({ kind: "p", text: line });
    i++;
  }
  return blocks;
}
