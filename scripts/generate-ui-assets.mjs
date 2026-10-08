import sharp from "sharp";
import { fileURLToPath, URL } from "node:url";

// Keep the original PNGs for branding exports and email compatibility.
const assets = [
  ["mddex-logo", 48],
  ["cost-icons/enchantment-points", 40],
  ["cost-icons/echo-shard", 40],
];
for (const [name, size] of assets) {
  for (const scale of [1, 2]) {
    const input = fileURLToPath(
      new URL(`../public/${name}.png`, import.meta.url),
    );
    const output = fileURLToPath(
      new URL(
        `../public/${name}${scale === 2 ? "@2x" : ""}.webp`,
        import.meta.url,
      ),
    );
    await sharp(input)
      .resize(size * scale, size * scale, {
        fit: "contain",
        background: { r: 0, g: 0, b: 0, alpha: 0 },
      })
      .webp({ lossless: true })
      .toFile(output);
  }
}
