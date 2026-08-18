const LINE_TOLERANCE = 2; // points of y-difference still counted as "same line"

// Groups tokens into lines (top-to-bottom), each line sorted left-to-right.
export function groupIntoLines(tokens) {
  const items = tokens.filter((t) => t.text.trim() !== "");

  // PDF y increases upward, so sorting descending gives top-to-bottom reading order
  const sorted = [...items].sort((a, b) => b.y - a.y);

  const lines = [];
  let currentLine = [];
  let currentY = null;

  for (const item of sorted) {
    if (currentY === null || Math.abs(item.y - currentY) <= LINE_TOLERANCE) {
      currentLine.push(item);
      currentY ??= item.y;
    } else {
      lines.push(currentLine);
      currentLine = [item];
      currentY = item.y;
    }
  }
  if (currentLine.length > 0) lines.push(currentLine);

  return lines.map((line) => [...line].sort((a, b) => a.x - b.x));
}

export function reconstructText(tokens) {
  return groupIntoLines(tokens)
    .map((line) =>
      line
        .map((item) => item.text)
        .join(" ")
        .replace(/\s+/g, " ")
        .trim()
    )
    .join("\n");
}
