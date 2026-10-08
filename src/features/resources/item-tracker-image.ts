import type { CatalogItem } from "../catalog/catalog.types";
import { categoryLabel } from "../catalog/catalog.helpers";
import {
  TRACKER_CATEGORIES,
  familyKeys,
  markKey,
  trackerFamilies,
  trackerMarks,
  trackerProgress,
} from "./item-tracker";

function loadImage(url: string | null): Promise<HTMLImageElement | undefined> {
  if (!url) return Promise.resolve(undefined);
  return new Promise((resolve) => {
    const image = new Image();
    image.crossOrigin = "anonymous";
    const finish = (loaded?: HTMLImageElement) => {
      clearTimeout(timer);
      image.onload = image.onerror = null;
      resolve(loaded);
    };
    const timer = setTimeout(() => {
      image.src = "";
      finish();
    }, 12000);
    image.onload = () => finish(image);
    image.onerror = () => finish();
    image.src = url;
  });
}

/** Render each owned item once; rarity and soul checkboxes remain in the totals. */
export async function createTrackerImage(
  catalog: CatalogItem[],
  collected: ReadonlySet<string>,
): Promise<Blob> {
  const groups = TRACKER_CATEGORIES.map((category) => ({
    category,
    families: trackerFamilies(catalog, category),
  }));
  const progress = trackerProgress(
    groups.flatMap((group) => group.families.flatMap(familyKeys)),
    collected,
  );
  const owned = groups
    .flatMap((group) =>
      group.families.flatMap((family) => [family.base, family.unique]),
    )
    .filter(
      (item): item is CatalogItem =>
        !!item &&
        trackerMarks(item).some((mark) => collected.has(markKey(item, mark))),
    );
  const images = await Promise.all(owned.map((item) => loadImage(item.image)));
  const canvas = document.createElement("canvas");
  canvas.width = 1200;
  canvas.height = 900;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Image rendering unavailable");
  ctx.fillStyle = "#090f11";
  ctx.fillRect(0, 0, 1200, 900);
  ctx.strokeStyle = "#263238";
  ctx.strokeRect(24.5, 24.5, 1151, 851);
  const text = (
    value: string,
    x: number,
    y: number,
    size: number,
    color = "#e5edef",
    weight = "400",
  ) => {
    ctx.fillStyle = color;
    ctx.font = `${weight} ${size}px monospace`;
    ctx.fillText(value, x, y);
  };
  text("MY COLLECTION", 60, 98, 48, "#e5edef", "700");
  text(".", 436, 98, 48, "#70cde8", "700");
  text("MINECRAFT DUNGEONS II", 62, 137, 16, "#95a4aa");
  const percentage = progress.total
    ? Math.round((progress.count / progress.total) * 100)
    : 0;
  ctx.textAlign = "right";
  text(`${percentage}%`, 1138, 102, 56, "#70cde8", "700");
  text(
    `${progress.count} / ${progress.total} tracked`,
    1138,
    139,
    17,
    "#95a4aa",
  );
  ctx.textAlign = "left";
  ctx.fillStyle = "#263238";
  ctx.fillRect(62, 167, 1076, 5);
  ctx.fillStyle = "#70cde8";
  ctx.fillRect(62, 167, (1076 * progress.count) / (progress.total || 1), 5);
  text(`${owned.length} items collected`, 62, 218, 23);
  // A soft pool of light beneath a scattered, layered heap of pixel artwork.
  const glow = ctx.createRadialGradient(600, 480, 10, 600, 480, 470);
  glow.addColorStop(0, "#152c35");
  glow.addColorStop(1, "#090f11");
  ctx.fillStyle = glow;
  ctx.fillRect(60, 250, 1080, 476);
  ctx.fillStyle = "#060a0c";
  ctx.beginPath();
  ctx.ellipse(600, 650, 350, 35, 0, 0, Math.PI * 2);
  ctx.fill();
  const placements = owned
    .map((item, index) => {
      const angle = index * 2.399963229728653;
      const radius = Math.sqrt((index + 0.5) / Math.max(owned.length, 1));
      const spread = Math.min(1, Math.sqrt(owned.length / 40));
      return {
        item,
        image: images[index],
        x: 600 + Math.cos(angle) * radius * 425 * spread,
        y: 485 + Math.sin(angle) * radius * 180 * spread,
        rotation: Math.sin(index * 17.7) * 0.32,
        index,
      };
    })
    .sort((a, b) => a.y - b.y);
  ctx.imageSmoothingEnabled = false;
  for (const entry of placements) {
    ctx.save();
    ctx.translate(entry.x, entry.y);
    ctx.rotate(entry.rotation);
    const size = owned.length > 120 ? 64 : owned.length > 40 ? 82 : 112;
    ctx.shadowColor = "#000000b0";
    ctx.shadowBlur = 8;
    ctx.shadowOffsetY = 7;
    if (entry.image) {
      const ratio = entry.image.naturalWidth / entry.image.naturalHeight;
      const width = ratio > 1 ? size : size * ratio;
      const height = ratio > 1 ? size / ratio : size;
      ctx.drawImage(entry.image, -width / 2, -height / 2, width, height);
    } else {
      // Missing publisher artwork still contributes an item to the pile.
      ctx.fillStyle =
        entry.item.game_data?.unique === true ? "#9c753b" : "#35535e";
      ctx.beginPath();
      ctx.moveTo(0, -size * 0.34);
      ctx.lineTo(size * 0.3, -size * 0.16);
      ctx.lineTo(size * 0.3, size * 0.18);
      ctx.lineTo(0, size * 0.36);
      ctx.lineTo(-size * 0.3, size * 0.18);
      ctx.lineTo(-size * 0.3, -size * 0.16);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = "#b3c9d0";
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(-size * 0.3, -size * 0.16);
      ctx.lineTo(0, size * 0.02);
      ctx.lineTo(size * 0.3, -size * 0.16);
      ctx.moveTo(0, size * 0.02);
      ctx.lineTo(0, size * 0.36);
      ctx.stroke();
    }
    ctx.restore();
  }
  if (!owned.length) {
    ctx.textAlign = "center";
    text("Every collection starts with one item.", 600, 485, 22, "#95a4aa");
    ctx.textAlign = "left";
  }
  ctx.strokeStyle = "#263238";
  ctx.beginPath();
  ctx.moveTo(62, 748);
  ctx.lineTo(1138, 748);
  ctx.stroke();
  groups.forEach((group, index) => {
    const state = trackerProgress(
      group.families.flatMap(familyKeys),
      collected,
    );
    const x = 62 + index * (1076 / groups.length);
    text(categoryLabel(group.category).toUpperCase(), x, 786, 13, "#95a4aa");
    text(`${state.count} / ${state.total}`, x, 820, 24, "#e5edef", "700");
  });
  text("MDDEX", 62, 858, 15, "#70cde8", "700");
  ctx.textAlign = "right";
  text("mddex.net/resources/item-tracker", 1138, 858, 14, "#95a4aa");
  return new Promise((resolve, reject) =>
    canvas.toBlob(
      (blob) =>
        blob ? resolve(blob) : reject(new Error("Image export failed")),
      "image/png",
    ),
  );
}
