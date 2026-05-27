"use node";

import OAuth from "oauth-1.0a";
import CryptoJS from "crypto-js";

export type BrickLinkType = "MINIFIG" | "PART" | "SET";

function getOauth() {
  const required = {
    BRICKLINK_CONSUMER_KEY: process.env.BRICKLINK_CONSUMER_KEY,
    BRICKLINK_CONSUMER_SECRET: process.env.BRICKLINK_CONSUMER_SECRET,
    BRICKLINK_TOKEN_VALUE: process.env.BRICKLINK_TOKEN_VALUE,
    BRICKLINK_TOKEN_SECRET: process.env.BRICKLINK_TOKEN_SECRET,
  };
  for (const [k, v] of Object.entries(required)) {
    if (!v) {
      throw new Error(
        `${k} missing on the Convex deployment. Run \`npx convex env set ${k} <value>\`.`,
      );
    }
  }
  return {
    oauth: new OAuth({
      consumer: {
        key: required.BRICKLINK_CONSUMER_KEY!,
        secret: required.BRICKLINK_CONSUMER_SECRET!,
      },
      signature_method: "HMAC-SHA1",
      hash_function: (base, key) =>
        CryptoJS.HmacSHA1(base, key).toString(CryptoJS.enc.Base64),
    }),
    token: {
      key: required.BRICKLINK_TOKEN_VALUE!,
      secret: required.BRICKLINK_TOKEN_SECRET!,
    },
  };
}

export interface CatalogItemData {
  no: string;
  name: string;
  type: BrickLinkType;
  image_url?: string;
  thumbnail_url?: string;
  year_released?: number;
  category_id?: number;
}

export async function catalogItem(opts: {
  type: BrickLinkType;
  no: string;
}): Promise<CatalogItemData> {
  const { oauth, token } = getOauth();
  const url = `https://api.bricklink.com/api/store/v1/items/${opts.type}/${encodeURIComponent(opts.no)}`;
  const authHeader = oauth.toHeader(
    oauth.authorize({ url, method: "GET" }, token),
  );
  const res = await fetch(url, {
    headers: { ...authHeader, Accept: "application/json" },
  });
  const body = (await res.json()) as {
    meta?: { code: number; message: string };
    data?: CatalogItemData;
  };
  if (!res.ok || body?.meta?.code !== 200 || !body.data) {
    throw new Error(
      `BrickLink ${res.status} on catalog ${opts.type}/${opts.no}: ${body?.meta?.message ?? res.statusText}`,
    );
  }
  return body.data;
}

export function normalizeBrickLinkImageUrl(url: string | undefined): string | undefined {
  if (!url) return undefined;
  if (url.startsWith("//")) return `https:${url}`;
  return url;
}

export interface PriceGuideData {
  min_price: string;
  max_price: string;
  avg_price: string;
  qty_avg_price: string;
  unit_quantity: number;
  total_quantity: number;
  currency_code: string;
}

export async function priceGuide(opts: {
  type: BrickLinkType;
  no: string;
  guideType: "stock" | "sold";
  newOrUsed: "N" | "U";
  countryCode?: string;
}): Promise<PriceGuideData> {
  const { oauth, token } = getOauth();
  const baseUrl = `https://api.bricklink.com/api/store/v1/items/${opts.type}/${encodeURIComponent(opts.no)}/price`;

  const data: Record<string, string> = {
    guide_type: opts.guideType,
    new_or_used: opts.newOrUsed,
  };
  if (opts.countryCode) data.country_code = opts.countryCode;

  const authHeader = oauth.toHeader(
    oauth.authorize({ url: baseUrl, method: "GET", data }, token),
  );
  const url = `${baseUrl}?${new URLSearchParams(data).toString()}`;

  const res = await fetch(url, {
    headers: { ...authHeader, Accept: "application/json" },
  });
  const body = (await res.json()) as {
    meta?: { code: number; message: string };
    data?: PriceGuideData;
  };
  if (!res.ok || body?.meta?.code !== 200 || !body.data) {
    throw new Error(
      `BrickLink ${res.status} on ${opts.type}/${opts.no} ${opts.guideType}/${opts.newOrUsed}: ${body?.meta?.message ?? res.statusText}`,
    );
  }
  return body.data;
}

/**
 * Map our radar region to a BrickLink country_code.
 * EU and GLOBAL are not country codes — we omit and let BrickLink return worldwide.
 * Returns null when no country filter should be applied.
 */
export function regionToCountryCode(region: string): string | undefined {
  if (region === "UK") return "GB";
  if (region === "US") return "US";
  return undefined;
}

/**
 * Resolve a BrickLink item number for an item.
 * - set: Rebrickable's set_num (e.g. "L0002247-1", "10261-1") matches
 *   BrickLink's set item number directly — keep the variant suffix.
 * - part: same number on both catalogs.
 * - minifig: fetch Rebrickable detail and read external_ids.BrickLink (or null).
 */
export async function resolveBrickLinkId(
  item: { rebrickableType: "minifig" | "part" | "set"; rebrickableId: string },
): Promise<string | null> {
  if (item.rebrickableType === "set") {
    return item.rebrickableId;
  }
  if (item.rebrickableType === "part") {
    return item.rebrickableId;
  }
  // minifig: ids differ; ask Rebrickable for cross-reference
  const key = process.env.REBRICKABLE_API_KEY;
  if (!key) return null;
  const res = await fetch(
    `https://rebrickable.com/api/v3/lego/minifigs/${encodeURIComponent(item.rebrickableId)}/`,
    { headers: { Authorization: `key ${key}` } },
  );
  if (!res.ok) return null;
  const data = (await res.json()) as { external_ids?: Record<string, string[]> };
  const blIds = data.external_ids?.BrickLink;
  if (Array.isArray(blIds) && blIds.length > 0) return blIds[0];
  return null;
}

export const TYPE_MAP: Record<"minifig" | "part" | "set", BrickLinkType> = {
  minifig: "MINIFIG",
  part: "PART",
  set: "SET",
};

export function startOfUtcDay(ms: number): number {
  const d = new Date(ms);
  d.setUTCHours(0, 0, 0, 0);
  return d.getTime();
}

export function toCents(s: string | number): number {
  const n = typeof s === "string" ? parseFloat(s) : s;
  if (!isFinite(n)) return 0;
  return Math.round(n * 100);
}
