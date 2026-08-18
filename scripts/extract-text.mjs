import { extractTokens } from "./lib/pdf.mjs";

const PDF_PATH = "sample-data/declarations.pdf";

const tokens = await extractTokens(PDF_PATH, 1);

for (const token of tokens) {
  console.log(token);
}
