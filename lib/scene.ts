import type { Destination, PaletteId } from "@/types";
import { hash } from "./format";

/** Palettes des paysages : ciel (haut, bas), silhouette de base, soleil. */
export const PALETTES: Record<PaletteId, { sky: [string, string]; base: string; sun: string }> = {
  sunset: { sky: ["#2B1B4F", "#FF7E5F"], base: "#1A1033", sun: "#FFD166" },
  peach: { sky: ["#3A1C4E", "#FFB088"], base: "#2A1540", sun: "#FFE1A8" },
  gold: { sky: ["#4A1F0F", "#FFB347"], base: "#2B1208", sun: "#FFF1B8" },
  teal: { sky: ["#0B2A3F", "#3EE0C8"], base: "#071A26", sun: "#FFF4D6" },
  dusk: { sky: ["#1D2440", "#E07A9E"], base: "#121631", sun: "#FFD8E6" },
  cool: { sky: ["#1A2B45", "#8FB8DE"], base: "#0F1B2E", sun: "#FFF9E8" },
  lagoon: { sky: ["#0E3A5C", "#7BE0D0"], base: "#082233", sun: "#FFF0C2" },
};

const hex2rgb = (h: string): [number, number, number] => {
  const n = parseInt(h.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};
/** Mélange deux couleurs hexadécimales ; t = 0 donne a, t = 1 donne b. */
export const mix = (a: string, b: string, t: number): string => {
  const A = hex2rgb(a);
  const B = hex2rgb(b);
  return `rgb(${A.map((v, i) => Math.round(v + (B[i] - v) * t)).join(",")})`;
};

export const SCENE_W = 320;
export const SCENE_H = 180;
const SW = SCENE_W;
const SH = SCENE_H;
const f = (n: number) => n.toFixed(0);

function hillsPath(horizon: number, minH: number, varH: number, r: (k: string) => number, key: string, n: number): string {
  let p = `M0,${horizon}`;
  let px = 0;
  let py = horizon - SH * (minH + varH * r(`${key}0`));
  p += ` L0,${f(py)}`;
  for (let i = 1; i <= n; i++) {
    const x = (SW * i) / n;
    const y = horizon - SH * (minH + varH * r(key + i));
    const dx = (x - px) / 2;
    p += ` C${f(px + dx)},${f(py)} ${f(x - dx)},${f(y)} ${f(x)},${f(y)}`;
    px = x;
    py = y;
  }
  return `${p} L${SW},${horizon} Z`;
}

/**
 * Paysage illustré d'une destination, en SVG (320 × 180, étiré en « cover »).
 * Déterministe : la même destination donne toujours la même image.
 */
export function sceneSVG(d: Destination): string {
  const s = d.scene;
  const P = PALETTES[s.p];
  const r = (k: string) => hash(`${d.id}|${k}`);
  const far = mix(P.base, P.sky[1], 0.55);
  const midC = mix(P.base, P.sky[1], 0.28);
  const water = mix(P.base, P.sky[1], 0.32);
  const horizon = Math.round(SH * (s.near === "ground" ? 0.72 : 0.64));
  const sunX = Math.round(SW * (0.2 + 0.6 * r("sun")));
  const sunY = Math.round(SH * 0.36);
  const sunR = Math.round(SH * 0.15);
  let o = `<svg class="scene" viewBox="0 0 ${SW} ${SH}" preserveAspectRatio="xMidYMid slice" aria-hidden="true"><defs><linearGradient id="sky-${d.id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${P.sky[0]}"/><stop offset="1" stop-color="${P.sky[1]}"/></linearGradient></defs>`;
  o += `<rect width="${SW}" height="${SH}" fill="url(#sky-${d.id})"/>`;
  for (let i = 0; i < 14; i++) {
    o += `<circle cx="${f(SW * r(`sx${i}`))}" cy="${f(SH * 0.5 * r(`sy${i}`))}" r="${(0.6 + r(`sr${i}`)).toFixed(1)}" fill="#fff" opacity="${(0.25 + 0.4 * r(`so${i}`)).toFixed(2)}"/>`;
  }
  o += `<circle cx="${sunX}" cy="${sunY}" r="${sunR * 2}" fill="${P.sun}" opacity=".16"/><circle cx="${sunX}" cy="${sunY}" r="${sunR}" fill="${P.sun}"/>`;

  // Lointain
  if (s.far === "mountains" || s.far === "alps") {
    const n = 7;
    const hgt = s.far === "alps" ? 0.46 : 0.3;
    const pts = [`0,${horizon}`];
    for (let i = 0; i <= n; i++) {
      pts.push(`${f((SW * i) / n)},${f(horizon - SH * hgt * (0.45 + 0.55 * r(`m${i}`)))}`);
      if (i < n) pts.push(`${f((SW * (i + 0.5)) / n)},${f(horizon - SH * hgt * 0.35 * r(`v${i}`))}`);
    }
    pts.push(`${SW},${horizon}`);
    o += `<polygon points="${pts.join(" ")}" fill="${far}"/>`;
    if (s.far === "alps") {
      for (let i = 0; i <= n; i++) {
        const x = (SW * i) / n;
        const y = horizon - SH * hgt * (0.45 + 0.55 * r(`m${i}`));
        o += `<polygon points="${f(x - 9)},${f(y + 10)} ${f(x)},${f(y)} ${f(x + 9)},${f(y + 10)}" fill="#fff" opacity=".55"/>`;
      }
    }
  } else if (s.far === "hills") {
    o += `<path d="${hillsPath(horizon, 0.13, 0.16, r, "h", 4)}" fill="${far}"/>`;
  } else if (s.far === "volcano") {
    const cx = SW * 0.68;
    const w = SW * 0.62;
    const top = horizon - SH * 0.34;
    o += `<polygon points="${f(cx - w / 2)},${horizon} ${f(cx - w * 0.07)},${f(top)} ${f(cx + w * 0.07)},${f(top)} ${f(cx + w / 2)},${horizon}" fill="${far}"/>`;
    o += `<circle cx="${f(cx + 6)}" cy="${f(top - 12)}" r="9" fill="${P.sun}" opacity=".22"/><circle cx="${f(cx + 16)}" cy="${f(top - 24)}" r="12" fill="${P.sun}" opacity=".16"/>`;
  }

  // Plan moyen
  if (s.mid === "city" || s.mid === "domes" || s.mid === "spires") {
    const n = 15;
    const bw = SW / n;
    for (let i = 0; i < n; i++) {
      const w = bw * (0.55 + 0.45 * r(`bw${i}`));
      const h = SH * (0.07 + 0.2 * r(`bh${i}`));
      const x = i * bw;
      const y = horizon - h;
      o += `<rect x="${f(x)}" y="${f(y)}" width="${f(w)}" height="${f(h + 2)}" fill="${midC}"/>`;
      if (s.mid === "domes" && i % 5 === 2) o += `<circle cx="${f(x + w / 2)}" cy="${f(y)}" r="${f(w * 0.62)}" fill="${midC}"/>`;
      if (s.mid === "spires" && i % 4 === 1) o += `<polygon points="${f(x)},${f(y)} ${f(x + w / 2)},${f(y - SH * 0.14)} ${f(x + w)},${f(y)}" fill="${midC}"/>`;
    }
  } else if (s.mid === "canalhouses") {
    const n = 11;
    const bw = SW / n;
    for (let i = 0; i < n; i++) {
      const h = SH * (0.14 + 0.12 * r(`ch${i}`));
      const x = i * bw + 1;
      const w = bw - 2;
      const y = horizon - h;
      o += `<rect x="${f(x)}" y="${f(y)}" width="${f(w)}" height="${f(h + 2)}" fill="${midC}"/><polygon points="${f(x)},${f(y)} ${f(x + w / 2)},${f(y - 12)} ${f(x + w)},${f(y)}" fill="${midC}"/>`;
    }
  } else if (s.mid === "dunes") {
    o += `<path d="${hillsPath(horizon, 0.05, 0.08, r, "d", 3)}" fill="${midC}"/>`;
  }

  // Premier plan
  if (s.near === "sea" || s.near === "beach") {
    const bottom = s.near === "beach" ? Math.round(SH * 0.84) : SH;
    o += `<rect x="0" y="${horizon}" width="${SW}" height="${bottom - horizon}" fill="${water}"/>`;
    o += `<ellipse cx="${sunX}" cy="${horizon + 10}" rx="${f(sunR * 0.9)}" ry="5" fill="${P.sun}" opacity=".32"/>`;
    for (let i = 0; i < 3; i++) {
      const y = horizon + 14 + i * 14;
      let p = `M0,${y}`;
      for (let x = 0; x < SW; x += 24) p += " q12,-3 24,0";
      o += `<path d="${p}" stroke="${P.sun}" stroke-width="1.2" fill="none" opacity=".22"/>`;
    }
    if (s.near === "beach") o += `<rect x="0" y="${bottom}" width="${SW}" height="${SH - bottom}" fill="${mix(P.sun, P.base, 0.45)}"/>`;
  } else if (s.near === "river") {
    const ribbon = `M0,${f(horizon + 18)} C${f(SW * 0.3)},${f(horizon + 6)} ${f(SW * 0.6)},${f(horizon + 40)} ${SW},${f(horizon + 26)}`;
    o += `<rect x="0" y="${horizon}" width="${SW}" height="${SH - horizon}" fill="${P.base}"/>`;
    o += `<path d="${ribbon}" stroke="${water}" stroke-width="16" fill="none"/><path d="${ribbon}" stroke="${P.sun}" stroke-width="1" fill="none" opacity=".25"/>`;
  } else if (s.near === "canal") {
    o += `<rect x="0" y="${horizon}" width="${SW}" height="${SH - horizon}" fill="${P.base}"/>`;
    o += `<rect x="0" y="${f(SH * 0.8)}" width="${SW}" height="${f(SH * 0.2)}" fill="${water}"/>`;
    for (let i = 0; i < 4; i++) {
      o += `<rect x="${f(SW * (0.1 + 0.25 * i))}" y="${f(SH * 0.8)}" width="14" height="${f(SH * 0.2)}" fill="${P.sun}" opacity=".12"/>`;
    }
  } else {
    o += `<rect x="0" y="${horizon}" width="${SW}" height="${SH - horizon}" fill="${P.base}"/>`;
  }
  return `${o}</svg>`;
}
