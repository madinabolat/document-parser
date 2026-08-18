import { extractTokens } from "./lib/pdf.mjs";
import { reconstructText } from "./lib/reconstruct-text.mjs";

const PDF_PATH = "sample-data/declarations.pdf";

const tokens = await extractTokens(PDF_PATH, 1);
const text = reconstructText(tokens);

console.log(text);
