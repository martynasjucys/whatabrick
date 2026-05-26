const BASE = "https://rebrickable.com/api/v3/lego";

function headers() {
  const key = process.env.REBRICKABLE_API_KEY;
  if (!key) {
    throw new Error(
      "REBRICKABLE_API_KEY missing on the Convex deployment. Run `npx convex env set REBRICKABLE_API_KEY <key>`.",
    );
  }
  return { Authorization: `key ${key}`, Accept: "application/json" };
}

export type RebrickableType = "minifig" | "part" | "set";

export interface RebrickableHit {
  type: RebrickableType;
  id: string;
  name: string;
  imageUrl?: string;
  year?: number;
  numParts?: number;
}

interface RawMinifig {
  set_num: string;
  name: string;
  num_parts?: number;
  set_img_url?: string | null;
}

interface RawPart {
  part_num: string;
  name: string;
  part_img_url?: string | null;
}

interface RawSet {
  set_num: string;
  name: string;
  year?: number;
  num_parts?: number;
  set_img_url?: string | null;
}

interface Paginated<T> {
  count: number;
  results: T[];
}

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url, { headers: headers() });
  if (!res.ok) {
    throw new Error(`Rebrickable ${res.status} ${res.statusText} on ${url}`);
  }
  return (await res.json()) as T;
}

export async function searchMinifigs(q: string, pageSize = 10): Promise<RebrickableHit[]> {
  const url = `${BASE}/minifigs/?search=${encodeURIComponent(q)}&page_size=${pageSize}`;
  const data = await fetchJson<Paginated<RawMinifig>>(url);
  return data.results.map((r) => ({
    type: "minifig",
    id: r.set_num,
    name: r.name,
    imageUrl: r.set_img_url ?? undefined,
    numParts: r.num_parts,
  }));
}

export async function searchParts(q: string, pageSize = 10): Promise<RebrickableHit[]> {
  const url = `${BASE}/parts/?search=${encodeURIComponent(q)}&page_size=${pageSize}`;
  const data = await fetchJson<Paginated<RawPart>>(url);
  return data.results.map((r) => ({
    type: "part",
    id: r.part_num,
    name: r.name,
    imageUrl: r.part_img_url ?? undefined,
  }));
}

export async function searchSets(q: string, pageSize = 10): Promise<RebrickableHit[]> {
  const url = `${BASE}/sets/?search=${encodeURIComponent(q)}&page_size=${pageSize}`;
  const data = await fetchJson<Paginated<RawSet>>(url);
  return data.results.map((r) => ({
    type: "set",
    id: r.set_num,
    name: r.name,
    imageUrl: r.set_img_url ?? undefined,
    year: r.year,
    numParts: r.num_parts,
  }));
}

export async function searchByType(
  type: RebrickableType,
  q: string,
  pageSize = 10,
): Promise<RebrickableHit[]> {
  if (type === "minifig") return searchMinifigs(q, pageSize);
  if (type === "part") return searchParts(q, pageSize);
  return searchSets(q, pageSize);
}
