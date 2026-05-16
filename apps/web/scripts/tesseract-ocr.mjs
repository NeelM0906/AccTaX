/* global URL, console, process */

import { mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { createWorker } from "tesseract.js";

const imagePaths = process.argv.slice(2);
const appRoot = new URL("../", import.meta.url);
const cachePath = fileURLToPath(new URL(".cache/tesseract/", appRoot));

if (imagePaths.length === 0) {
  console.log(JSON.stringify({ pages: [] }));
  process.exit(0);
}

await mkdir(cachePath, { recursive: true });
const worker = await createWorker("eng", 1, { cachePath });

try {
  const pages = [];

  for (let index = 0; index < imagePaths.length; index += 1) {
    const imagePath = imagePaths[index];
    const result = await worker.recognize(imagePath);
    pages.push({
      pageNumber: index + 1,
      text: result.data.text ?? "",
      confidence: Number.isFinite(result.data.confidence)
        ? result.data.confidence / 100
        : undefined
    });
  }

  console.log(JSON.stringify({ pages }));
} finally {
  await worker.terminate();
}
