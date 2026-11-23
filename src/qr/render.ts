import { encode } from 'uqr';
import { esc } from '../ui/kit';

/** Renders text as a crisp QR SVG (one merged path). Larger payloads drop to ECC M and skip the logo. */
export function qrSvg(text: string): { svg: string; logo: boolean } {
  const logo = text.length <= 380;
  const qr = encode(text, { ecc: logo ? 'Q' : 'M', border: 0 });
  const n = qr.size;
  let d = '';
  for (let y = 0; y < n; y++) {
    const row = qr.data[y]!;
    for (let x = 0; x < n;) {
      if (!row[x]) { x++; continue; }
      let w = 1;
      while (x + w < n && row[x + w]) w++;
      d += `M${x} ${y}h${w}v1h-${w}z`;
      x += w;
    }
  }
  return { svg: `<svg viewBox="0 0 ${n} ${n}" shape-rendering="crispEdges" role="img" aria-label="QR code"><path d="${d}" fill="#0b0f0d"/></svg>`, logo };
}

export function qrFrame(text: string): string {
  const { svg, logo } = qrSvg(text);
  return `<div class="qr-frame">${svg}${logo ? '<img class="qr-logo" src="./brand.svg" alt="">' : ''}</div>`;
}

export const codeSnippet = (text: string) => `<div class="qr-code-text" title="${esc(text)}">${esc(text)}</div>`;
