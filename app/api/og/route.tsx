import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";
import type { NextRequest } from "next/server";
import type { TripOption } from "@/types";
import { eur, fmtShort, listFr } from "@/lib/format";
import { sceneFor } from "@/lib/scene";
import { paramsFromShared, searchTrips } from "@/lib/search-server";
import { decodeShare } from "@/lib/share";

const MODE_LABEL = { plane: "avion", train: "train", bus: "bus", car: "covoiturage" } as const;
const W = 1200;
const H = 630;

/** Polices lues une fois par processus ; incluses dans le déploiement via outputFileTracingIncludes. */
let fontsPromise: Promise<{ name: string; data: ArrayBuffer; weight: 500 | 700 | 800 }[]> | null = null;
function loadFonts() {
  fontsPromise ??= Promise.all(
    (
      [
        ["Unbounded", "unbounded-800.woff", 800],
        ["Manrope", "manrope-500.woff", 500],
        ["Manrope", "manrope-700.woff", 700],
      ] as const
    ).map(async ([name, file, weight]) => {
      const buf = await readFile(join(process.cwd(), "assets", "fonts", file));
      return { name, data: buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer, weight };
    }),
  );
  return fontsPromise;
}

const sceneDataUri = (trip: TripOption) => `data:image/svg+xml;base64,${Buffer.from(sceneFor(trip.destination)).toString("base64")}`;

function Brand() {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
      <div style={{ width: 56, height: 56, borderRadius: 18, background: "linear-gradient(135deg, #FF6B7A, #FF9A5C)", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="#1C0D0B" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M17.8 19.2 16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.5-.1 1 .3 1.3L9 12l-2 3H4l-1 1 3 2 2 3 1-1v-3l3-2 3.5 5.3c.3.4.8.5 1.3.3l.5-.2c.4-.3.6-.7.5-1.2z" />
        </svg>
      </div>
      <div style={{ fontFamily: "Unbounded", fontSize: 36, fontWeight: 800, color: "#F2F4FA" }}>Escapade</div>
    </div>
  );
}

function Pill({ children }: { children: string }) {
  return <div style={{ display: "flex", padding: "12px 22px", borderRadius: 999, background: "rgba(255,255,255,0.14)", border: "1px solid rgba(255,255,255,0.25)", color: "#F2F4FA", fontSize: 26, fontWeight: 700 }}>{children}</div>;
}

/** Carte d'une escapade précise : paysage en fond, ville, dates, prix par personne. */
function TripCard({ trip, from, travelers }: { trip: TripOption; from: string; travelers: number }) {
  const d = trip.destination;
  const w = trip.window;
  return (
    <div style={{ width: W, height: H, display: "flex", position: "relative", fontFamily: "Manrope", color: "#F2F4FA", backgroundColor: "#070A12", backgroundImage: `url(${sceneDataUri(trip)})`, backgroundSize: `${W}px ${H}px` }}>
      <div style={{ position: "absolute", top: 0, left: 0, width: W, height: H, background: "linear-gradient(to top, rgba(7,10,18,0.97) 0%, rgba(7,10,18,0.62) 42%, rgba(7,10,18,0.08) 100%)" }} />
      <div style={{ position: "absolute", top: 44, left: 56, right: 56, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <Brand />
        <Pill>{`depuis ${from}`}</Pill>
      </div>
      <div style={{ position: "absolute", left: 56, right: 56, bottom: 48, display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 10, maxWidth: 720 }}>
          <div style={{ fontFamily: "Unbounded", fontSize: 92, fontWeight: 800, lineHeight: 1, letterSpacing: -2 }}>{d.city}</div>
          <div style={{ fontSize: 30, fontWeight: 500, color: "#C9D0DD" }}>{`${d.country} · ${fmtShort(w.out)} → ${fmtShort(w.ret)} · ${trip.temp} °C`}</div>
          <div style={{ fontSize: 26, fontWeight: 500, color: "#A3ABBE" }}>{d.land.join(" · ")}</div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 8, padding: "26px 34px", borderRadius: 28, background: "linear-gradient(135deg, #FF6B7A, #FF9A5C)", color: "#1C0D0B" }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
            <div style={{ fontFamily: "Unbounded", fontSize: 72, fontWeight: 800, lineHeight: 1 }}>{eur(trip.perPerson)}</div>
            <div style={{ fontSize: 28, fontWeight: 700 }}>/ pers.</div>
          </div>
          <div style={{ fontSize: 24, fontWeight: 700, opacity: 0.85 }}>{`${MODE_LABEL[trip.best.mode]} + ${w.nights} nuits · ${eur(trip.total)} pour ${travelers}`}</div>
        </div>
      </div>
    </div>
  );
}

/** Carte générique d'une recherche : accroche, nombre d'escapades et prix d'appel. */
function SearchCard({ count, from, cheapest, when }: { count: number; from: string; cheapest: TripOption | null; when: string }) {
  return (
    <div style={{ width: W, height: H, display: "flex", position: "relative", fontFamily: "Manrope", color: "#F2F4FA", background: "radial-gradient(circle at 15% 10%, rgba(255,95,126,0.55), transparent 45%), radial-gradient(circle at 90% 90%, rgba(46,211,190,0.5), transparent 45%), radial-gradient(circle at 60% 40%, rgba(255,182,92,0.25), transparent 40%), #0C1120" }}>
      <div style={{ position: "absolute", top: 44, left: 56, right: 56, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <Brand />
        <Pill>{when}</Pill>
      </div>
      <div style={{ position: "absolute", left: 56, right: 56, bottom: 56, display: "flex", flexDirection: "column", gap: 22 }}>
        <div style={{ fontFamily: "Unbounded", fontSize: 76, fontWeight: 800, lineHeight: 1.05, letterSpacing: -1 }}>{`On part où ${when} ?`}</div>
        <div style={{ fontSize: 34, fontWeight: 500, color: "#C9D0DD" }}>
          {cheapest ? `${count} escapades dès ${eur(cheapest.perPerson)} par personne depuis ${from}, transport et nuits compris.` : `Depuis ${from}, au meilleur prix, en dix secondes.`}
        </div>
      </div>
    </div>
  );
}

/** GET /api/og?… : image d'aperçu (Open Graph) d'un lien partagé, mêmes paramètres que la page. */
export async function GET(req: NextRequest) {
  const shared = decodeShare(Object.fromEntries(req.nextUrl.searchParams));
  const params = paramsFromShared(shared);
  const from = listFr(params.departures.map((d) => d.label)) || "chez toi";
  let trips: TripOption[] = [];
  try {
    trips = (await searchTrips(params)).trips;
  } catch (e) {
    console.warn("[api/og]", (e as Error).message);
  }
  const inBudget = trips.filter((t) => t.perPerson <= params.budget && params.vibes.every((v) => t.destination.vibes.includes(v))).sort((a, b) => a.perPerson - b.perPerson);
  const open = shared.open ? trips.find((t) => t.destination.id === shared.open) : undefined;
  const when = params.dateMode === "fixed" ? `du ${fmtShort(params.dateOut)} au ${fmtShort(params.dateIn)}` : { weekend: "ce week-end", long: "ce long week-end", week: "cette semaine" }[params.duration];

  return new ImageResponse(open ? <TripCard trip={open} from={from} travelers={params.travelers} /> : <SearchCard count={inBudget.length} from={from} cheapest={inBudget[0] ?? null} when={when} />, {
    width: W,
    height: H,
    fonts: (await loadFonts()).map((f) => ({ name: f.name, data: f.data, weight: f.weight, style: "normal" as const })),
    headers: { "Cache-Control": "public, max-age=3600, s-maxage=86400" },
  });
}
