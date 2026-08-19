# document-parser

## What this is
A tool that takes a PDF + a requested field (e.g. "Policy Number"), and returns the value **plus** proof of where it came from: a rationale, a verbatim quote, and a highlighted bounding box on the source page. Learning project — built incrementally, step by step, not generated wholesale. See `Madina_Notes.md` for scope and `Claude_Notes.md` for full design discussion history.

## Architecture (5 layers)
1. Upload & schema input (UI) — not built yet.
2. **PDF tokenization** — parse PDF into `{text, x, y, width, height}` per text run. Built.
3. **AI extraction** — send plain reconstructed text + field name to an LLM, get back `{value, rationale, quote}`. Deliberately never ask the AI for coordinates — it's unreliable at that; only ask for what it's good at (reading/quoting). Not built yet.
4. **Grounding** — deterministic code (no AI) that takes the AI's `quote` and searches the token list for it, returning a bounding box. Built.
5. Rendering — draw the PDF page + highlight box in the browser. Not built yet.

Key design principle: AI does judgment/reading tasks (prediction-based, so verify it); deterministic code does measurement/computation tasks (exact, so trust it). Coordinates are always computed by our own code, never by the AI.

## Current state (v0, in progress)
- Node project, one dependency: `pdfjs-dist`.
- Sample file: `sample-data/declarations.pdf` (private, gitignored, never commit) — a real 185-page insurance declarations doc. v0 only touches page 1.
- Target field: **Policy Number** (confirmed present as its own token on page 1, single-column region — safe from the multi-column issue noted below).

### Files
- `scripts/lib/pdf.mjs` — `extractTokens(pdfPath, pageNumber)`: reads a PDF page via pdfjs-dist, returns flat token list.
- `scripts/lib/reconstruct-text.mjs` — `groupIntoLines(tokens)` / `reconstructText(tokens)`: orders tokens into reading order (top-to-bottom by y, left-to-right by x within a line) and glues into plain text.
- `scripts/lib/ground-quote.mjs` — `findBoundingBox(tokens, quote)`: sliding-window search over ordered tokens; returns a union bounding box if `quote` matches one or more consecutive tokens, else `null`.
- `scripts/extract-text.mjs`, `scripts/print-page-text.mjs`, `scripts/ground-quote.mjs` — thin entry-point scripts (`node scripts/<name>.mjs`) exercising the lib functions above. `ground-quote.mjs` currently uses a **hardcoded test quote** as a stand-in for what the AI will eventually return — this is temporary scaffolding, not final design.

### Verified so far
- Tokenization + reconstruction produce clean, correctly-ordered text for the Policy Number region.
- Grounding works for both a single-token quote and a multi-token quote (union bounding box confirmed correct in both cases).
- Known, deliberately out-of-scope limitation, confirmed empirically (not hypothetical): further down page 1, a real two-column layout (Insurer vs. Agency/Broker info) breaks the row-based text reconstruction into garbled text. Doesn't affect the Policy Number field. Would need column-aware layout detection to fix — not needed for v0.

## Explicitly out of scope for v0
Scanned PDFs / OCR, table structure extraction, multi-column reading order, multi-field schema, upload UI, auth, database, deployment.

## Next step
Build the AI extraction call: send `reconstructText()` output + field name to an LLM with structured output, get back `{value, quote, rationale}`. Then replace the hardcoded quote in `scripts/ground-quote.mjs` with the AI's real output — full pipeline, tokenize → AI extract → ground → bbox, end to end.

## Collaboration style
Building this step by step to learn, not having it built wholesale. Before each step: explain what/why/how it fits the architecture. Introduce new terms with brief in-context definitions, but don't pre-teach ahead of what's needed. After each step: explain what changed, confirm understanding, before moving on.
