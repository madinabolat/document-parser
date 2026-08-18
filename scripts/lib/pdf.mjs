import { readFile } from "node:fs/promises";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";

export async function extractTokens(pdfPath, pageNumber) {
  const buffer = await readFile(pdfPath);
  const doc = await getDocument({ data: new Uint8Array(buffer) }).promise;
  const page = await doc.getPage(pageNumber);
  const textContent = await page.getTextContent();

  return textContent.items.map((item) => {
    const [, , , , x, y] = item.transform;
    return {
      text: item.str,
      x,
      y,
      width: item.width,
      height: item.height,
    };
  });
}
