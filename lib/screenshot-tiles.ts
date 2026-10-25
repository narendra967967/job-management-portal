// Browser-only: prepare a screenshot for AI reading ("Add with AI").
//
// Vision models shrink big images to a fixed budget (OpenAI: short side 768px;
// Anthropic: ~1.15 MP). A full-page screenshot (e.g. 1300×4500) shrinks so much
// the text becomes unreadable — and the model then invents a "typical" job post.
// So: trim plain side margins, cap the width, and cut the page into wide,
// slightly overlapping slices (≈ 4:3) that each survive the shrink readable.
// Small images go through untouched. Any failure → the original file.

const MAX_WIDTH = 1600;
/** Slice height as a share of width: wide slices lose the least when shrunk. */
const SLICE_RATIO = 0.75;
const OVERLAP = 60;
export const MAX_SLICES = 14;
/** Keep the whole upload under the Server Action body limit (6 MB). */
const MAX_TOTAL_BYTES = 5.5 * 1024 * 1024;

function canvas(w: number, h: number) {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const ctx = c.getContext("2d");
  if (!ctx) throw new Error("no canvas");
  return { c, ctx };
}

/** Columns [left, right) holding content — page margins of one flat colour trimmed. */
function contentColumns(bmp: ImageBitmap): [number, number] {
  const sw = Math.min(400, bmp.width);
  const sh = Math.max(1, Math.round((bmp.height * sw) / bmp.width));
  const { ctx } = canvas(sw, sh);
  ctx.drawImage(bmp, 0, 0, sw, sh);
  const { data } = ctx.getImageData(0, 0, sw, sh);
  const busy = (x: number) => {
    let min = 255;
    let max = 0;
    for (let y = 0; y < sh; y += 2) {
      const i = (y * sw + x) * 4;
      const l = (data[i] * 3 + data[i + 1] * 6 + data[i + 2]) / 10;
      if (l < min) min = l;
      if (l > max) max = l;
    }
    return max - min > 12;
  };
  let l = 0;
  while (l < sw - 1 && !busy(l)) l++;
  let r = sw - 1;
  while (r > l && !busy(r)) r--;
  const scale = bmp.width / sw;
  const pad = 8;
  const left = Math.max(0, Math.floor((l - pad) * scale));
  const right = Math.min(bmp.width, Math.ceil((r + 1 + pad) * scale));
  // Only bother when it actually saves something.
  return right - left < bmp.width * 0.92 ? [left, right] : [0, bmp.width];
}

function toBlob(c: HTMLCanvasElement, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) =>
    c.toBlob((b) => (b ? resolve(b) : reject(new Error("encode"))), "image/jpeg", quality),
  );
}

/** One or more image files ready to send, top to bottom. */
export async function prepareScreenshot(file: File): Promise<File[]> {
  try {
    const bmp = await createImageBitmap(file);
    const [left, right] = contentColumns(bmp);
    const cropW = right - left;
    let scale = Math.min(1, MAX_WIDTH / cropW);
    let outW = Math.round(cropW * scale);
    let sliceH = Math.round(outW * SLICE_RATIO);
    let outH = Math.round(bmp.height * scale);

    // Already readable as one image: send the original.
    if (left === 0 && right === bmp.width && scale === 1 && outH <= sliceH * 1.4) {
      bmp.close();
      return [file];
    }
    // Very long pages: shrink until the slices fit the cap.
    const slicesFor = (h: number, s: number) => (h <= s ? 1 : Math.ceil((h - OVERLAP) / (s - OVERLAP)));
    while (slicesFor(outH, sliceH) > MAX_SLICES) {
      scale *= 0.9;
      outW = Math.round(cropW * scale);
      sliceH = Math.round(outW * SLICE_RATIO);
      outH = Math.round(bmp.height * scale);
    }

    const tops: number[] = [];
    for (let top = 0; ; top += sliceH - OVERLAP) {
      tops.push(Math.min(top, Math.max(0, outH - sliceH)));
      if (top + sliceH >= outH) break;
    }

    let quality = 0.85;
    for (;;) {
      const out: File[] = [];
      let total = 0;
      for (const [i, top] of tops.entries()) {
        const h = Math.min(sliceH, outH - top);
        const { c, ctx } = canvas(outW, h);
        ctx.fillStyle = "#fff";
        ctx.fillRect(0, 0, outW, h);
        ctx.drawImage(bmp, left, top / scale, cropW, h / scale, 0, 0, outW, h);
        const blob = await toBlob(c, quality);
        total += blob.size;
        out.push(new File([blob], `slice-${i + 1}.jpg`, { type: "image/jpeg" }));
      }
      if (total <= MAX_TOTAL_BYTES || quality <= 0.5) {
        bmp.close();
        return out;
      }
      quality -= 0.15;
    }
  } catch {
    return [file];
  }
}
