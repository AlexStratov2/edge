// Tiny filesystem cache for fetched source text. Because the app runs locally,
// caching raw downloads to disk keeps the dashboard snappy and avoids hammering
// the free data sources during development.

import { promises as fs } from "fs";
import path from "path";
import crypto from "crypto";

const CACHE_DIR = path.join(process.cwd(), ".cache");

interface CacheOpts {
  /** Time-to-live in milliseconds. */
  ttlMs: number;
  /** Extra request headers (e.g. an API key). Not part of the cache identity. */
  headers?: Record<string, string>;
}

async function ensureDir() {
  await fs.mkdir(CACHE_DIR, { recursive: true });
}

function keyFor(url: string): string {
  return crypto.createHash("sha1").update(url).digest("hex");
}

/**
 * Fetch `url` as text, caching the response on disk for `ttlMs`. On a network
 * error it falls back to any stale cached copy so the UI still renders.
 */
export async function fetchTextCached(url: string, opts: CacheOpts): Promise<string> {
  await ensureDir();
  const file = path.join(CACHE_DIR, keyFor(url));
  try {
    const stat = await fs.stat(file);
    if (Date.now() - stat.mtimeMs < opts.ttlMs) {
      return await fs.readFile(file, "utf8");
    }
  } catch {
    // no cache yet
  }

  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "bets-statistics/1.0 (local dashboard)", ...opts.headers },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
    const text = await res.text();
    await fs.writeFile(file, text, "utf8");
    return text;
  } catch (err) {
    // Fall back to a stale cache if we have one.
    try {
      return await fs.readFile(file, "utf8");
    } catch {
      throw err;
    }
  }
}
