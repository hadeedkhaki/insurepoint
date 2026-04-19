import { Redis } from '@upstash/redis';

const URL = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
const TOKEN = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;

export const USE_KV = Boolean(URL && TOKEN);

const kv = USE_KV ? new Redis({ url: URL, token: TOKEN }) : null;

const K = {
  registrations: 'insured:registrations',
  scanHistory: 'insured:scanHistory',
  scanCounter: 'insured:scanCounter',
  regCounter: 'insured:regCounter',
  auditLog: 'insured:auditLog',
  dynamicCards: 'insured:dynamicCards',
  seeded: 'insured:seeded',
};

const memory = {
  registrations: [],
  scanHistory: [],
  scanCounter: 0,
  regCounter: 0,
  auditLog: [],
  dynamicCards: [],
  seeded: false,
};

let seedPromise = null;

export function ensureSeeded(buildSeeds) {
  if (!seedPromise) seedPromise = doSeed(buildSeeds);
  return seedPromise;
}

async function doSeed(buildSeeds) {
  if (USE_KV) {
    const already = await kv.get(K.seeded);
    if (already) return;
    const seeds = buildSeeds();
    if (seeds.length > 0) {
      await kv.rpush(K.scanHistory, ...seeds);
    }
    await kv.set(K.scanCounter, seeds.length);
    await kv.set(K.regCounter, 0);
    await kv.set(K.seeded, 1);
    return;
  }
  if (memory.seeded) return;
  memory.scanHistory = buildSeeds();
  memory.scanCounter = memory.scanHistory.length;
  memory.regCounter = 0;
  memory.seeded = true;
}

// ---- Scan history ----
export async function getScanHistory() {
  if (USE_KV) return (await kv.lrange(K.scanHistory, 0, -1)) || [];
  return memory.scanHistory;
}

export async function pushScan(scan) {
  if (USE_KV) {
    await kv.rpush(K.scanHistory, scan);
    return;
  }
  memory.scanHistory.push(scan);
}

export async function updateScanStatus(id, status) {
  if (USE_KV) {
    const all = (await kv.lrange(K.scanHistory, 0, -1)) || [];
    const idx = all.findIndex((s) => s.id === id);
    if (idx === -1) return null;
    const oldStatus = all[idx].status;
    const updated = { ...all[idx], status };
    await kv.lset(K.scanHistory, idx, updated);
    return { entry: updated, oldStatus };
  }
  const entry = memory.scanHistory.find((s) => s.id === id);
  if (!entry) return null;
  const oldStatus = entry.status;
  entry.status = status;
  return { entry, oldStatus };
}

export async function nextScanId() {
  if (USE_KV) {
    const n = await kv.incr(K.scanCounter);
    return `scan-${n}`;
  }
  memory.scanCounter++;
  return `scan-${memory.scanCounter}`;
}

// ---- Registrations ----
export async function getRegistrations() {
  if (USE_KV) return (await kv.lrange(K.registrations, 0, -1)) || [];
  return memory.registrations;
}

export async function pushRegistration(reg) {
  if (USE_KV) {
    await kv.rpush(K.registrations, reg);
    return;
  }
  memory.registrations.push(reg);
}

export async function nextRegId() {
  if (USE_KV) {
    const n = await kv.incr(K.regCounter);
    return `reg-${n}`;
  }
  memory.regCounter++;
  return `reg-${memory.regCounter}`;
}

// ---- Audit log ----
export async function appendAudit(record) {
  if (USE_KV) {
    await kv.rpush(K.auditLog, record);
    await kv.ltrim(K.auditLog, -1000, -1);
    return;
  }
  memory.auditLog.push(record);
  if (memory.auditLog.length > 1000) memory.auditLog.shift();
}

export async function getAuditLog() {
  if (USE_KV) return (await kv.lrange(K.auditLog, 0, -1)) || [];
  return memory.auditLog;
}

// ---- Dynamic cards (added via registration) ----
export async function pushDynamicCard(card) {
  if (USE_KV) {
    await kv.rpush(K.dynamicCards, card);
    return;
  }
  memory.dynamicCards.push(card);
}

export async function getDynamicCards() {
  if (USE_KV) return (await kv.lrange(K.dynamicCards, 0, -1)) || [];
  return memory.dynamicCards;
}
