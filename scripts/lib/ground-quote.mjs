import { groupIntoLines } from "./reconstruct-text.mjs";

const MAX_WINDOW = 20; // max tokens to try combining into one quote match

function normalize(text) {
  return text.trim().replace(/\s+/g, " ").toLowerCase();
}

function unionBoundingBox(items) {
  const minX = Math.min(...items.map((i) => i.x));
  const minY = Math.min(...items.map((i) => i.y));
  const maxX = Math.max(...items.map((i) => i.x + i.width));
  const maxY = Math.max(...items.map((i) => i.y + i.height));
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}

// Finds where `quote` appears in `tokens`, returning its (possibly multi-token) bounding box.
// Returns null if no match is found.
export function findBoundingBox(tokens, quote) {
  const orderedTokens = groupIntoLines(tokens).flat();
  const normalizedQuote = normalize(quote);

  for (let start = 0; start < orderedTokens.length; start++) {
    let text = "";
    const end = Math.min(start + MAX_WINDOW, orderedTokens.length);

    for (let i = start; i < end; i++) {
      text = text ? `${text} ${orderedTokens[i].text}` : orderedTokens[i].text;
      const normalizedText = normalize(text);

      if (normalizedText === normalizedQuote) {
        return unionBoundingBox(orderedTokens.slice(start, i + 1));
      }
      if (normalizedText.length > normalizedQuote.length) break;
    }
  }

  return null;
}
