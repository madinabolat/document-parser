import { extractTokens } from "./lib/pdf.mjs";
import { findBoundingBox } from "./lib/ground-quote.mjs";

const PDF_PATH = "sample-data/declarations.pdf";
const QUOTE = "91804191125XXXPHPS01"; // stand-in for what the AI will eventually return

const tokens = await extractTokens(PDF_PATH, 1);
const bbox = findBoundingBox(tokens, QUOTE);

console.log(bbox);
