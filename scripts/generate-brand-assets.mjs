import { readFile, writeFile } from "node:fs/promises";
import { URL } from "node:url";
import { Buffer } from "node:buffer";
import { chromium } from "@playwright/test";
const root = new URL("../", import.meta.url);
const logo = `data:image/png;base64,${(await readFile(new URL("public/mddex-logo.png", root))).toString("base64")}`;
const browser = await chromium.launch();
try {
  const page = await browser.newPage({
    viewport: { width: 1200, height: 630 },
    deviceScaleFactor: 1,
  });
  for (const [size, name] of [
    [32, "favicon-32x32.png"],
    [180, "apple-touch-icon.png"],
    [192, "icon-192.png"],
    [512, "icon-512.png"],
  ]) {
    await page.setViewportSize({ width: size, height: size });
    await page.setContent(
      `<html><body style="margin:0;width:${size}px;height:${size}px;background:#080f11;display:grid;place-items:center"><img src="${logo}" style="width:90%;height:90%;object-fit:contain"></body></html>`,
    );
    await page.locator("img").evaluate((image) => image.decode());
    await page.screenshot({ path: new URL(`public/${name}`, root).pathname });
  }
  const png = await readFile(new URL("public/favicon-32x32.png", root));
  const header = Buffer.alloc(22);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(1, 4);
  header[6] = 32;
  header[7] = 32;
  header.writeUInt16LE(1, 10);
  header.writeUInt16LE(32, 12);
  header.writeUInt32LE(png.length, 14);
  header.writeUInt32LE(22, 18);
  await writeFile(
    new URL("public/favicon.ico", root),
    Buffer.concat([header, png]),
  );
} finally {
  await browser.close();
}
