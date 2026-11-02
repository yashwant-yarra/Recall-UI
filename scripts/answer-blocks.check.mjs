// Self-check for src/lib/answerBlocks.ts. Run: node scripts/answer-blocks.check.mjs
import assert from "node:assert/strict";
import { normalize, parseAnswer } from "../src/lib/answerBlocks.ts";

// Numbering survives blank lines and nested bullets between items (it used to restart at 1).
let b = parseAnswer("Steps:\n\n1. **Light** [1]\n    *   chlorophyll absorbs light\n    *   water splits\n\n2. Calvin cycle [2]\n3. Sugar");
assert.equal(b.length, 2);
assert.equal(b[1].kind, "list");
assert.equal(b[1].ordered, true);
assert.deepEqual(b[1].items.map((x) => x.value), [1, 2, 3]);
assert.deepEqual(b[1].items[0].children.items.map((x) => x.text), ["chlorophyll absorbs light", "water splits"]);

// A list of the other kind right after starts its own block.
b = parseAnswer("- a\n- b\n1. one");
assert.deepEqual(b.map((x) => [x.kind, x.ordered]), [["list", false], ["list", true]]);

// An indented plain line continues the item above.
b = parseAnswer("1. First line\n   still the first item\n2. Second");
assert.equal(b[0].items[0].text, "First line still the first item");

// Citations inside bold move after it, so the bold stays whole.
assert.equal(normalize("**Mitochondria [1]** make energy"), "**Mitochondria**[1] make energy");
assert.equal(normalize("**Term [1, 2]:** meaning"), "**Term:**[1, 2] meaning");
assert.equal(normalize("**plain bold** stays"), "**plain bold** stays");
assert.equal(normalize("***both***"), "**both**");

// LaTeX delimiters, and display math over several lines.
assert.equal(normalize("speed \\(v = d/t\\) here"), "speed $v = d/t$ here");
assert.equal(normalize("\\[\nE = mc^2\n\\]"), "$$ E = mc^2 $$");

// Tables, code blocks, rules and headings.
b = parseAnswer("| Term | Meaning |\n|---|:---:|\n| ATP | energy [1] |\n| ADP | spent |\n\nAfter.");
assert.deepEqual(b[0], { kind: "table", head: ["Term", "Meaning"], rows: [["ATP", "energy [1]"], ["ADP", "spent"]] });
assert.deepEqual(b[1], { kind: "p", text: "After." });
b = parseAnswer("```python\nx = 1\n\ny = 2\n```\n---\n#### Summary ##\n* * *");
assert.deepEqual(b, [{ kind: "code", text: "x = 1\n\ny = 2" }, { kind: "hr" }, { kind: "h", text: "Summary" }, { kind: "hr" }]);

// A pipe that isn't a table stays a paragraph.
assert.deepEqual(parseAnswer("| not a table"), [{ kind: "p", text: "| not a table" }]);

console.log("answer-blocks: all checks pass");
