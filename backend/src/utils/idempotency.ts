// backend/src/utils/idempotency.ts

export interface CachedIdempotentResponse {
  status: number;
  body: any;
  cachedAt: number;
}

// In-memory store for idempotency keys with 24-hour TTL
const idempotencyStore = new Map<string, CachedIdempotentResponse>();
const inFlightOperations = new Set<string>();

const DEFAULT_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

function buildCompositeKey(ownerId: string, idempotencyKey: string): string {
  return `${String(ownerId).trim()}::${String(idempotencyKey).trim()}`;
}

/**
 * Checks if a response was already committed for this owner and idempotency key.
 */
export function getIdempotentResponse(
  ownerId: string,
  idempotencyKey: string | undefined | null
): CachedIdempotentResponse | null {
  if (!idempotencyKey || typeof idempotencyKey !== 'string' || !idempotencyKey.trim()) {
    return null;
  }
  const key = buildCompositeKey(ownerId, idempotencyKey);
  const entry = idempotencyStore.get(key);
  if (!entry) return null;

  // Evict expired entries
  if (Date.now() - entry.cachedAt > DEFAULT_TTL_MS) {
    idempotencyStore.delete(key);
    return null;
  }

  return entry;
}

/**
 * Caches the committed HTTP response for an idempotency key.
 */
export function recordIdempotentResponse(
  ownerId: string,
  idempotencyKey: string | undefined | null,
  status: number,
  body: any
): void {
  if (!idempotencyKey || typeof idempotencyKey !== 'string' || !idempotencyKey.trim()) {
    return;
  }
  const key = buildCompositeKey(ownerId, idempotencyKey);
  idempotencyStore.set(key, {
    status,
    body: JSON.parse(JSON.stringify(body)),
    cachedAt: Date.now(),
  });
  inFlightOperations.delete(key);
}

/**
 * Checks whether an operation for this idempotency key is currently processing.
 */
export function isOperationInProgress(
  ownerId: string,
  idempotencyKey: string | undefined | null
): boolean {
  if (!idempotencyKey || typeof idempotencyKey !== 'string' || !idempotencyKey.trim()) {
    return false;
  }
  return inFlightOperations.has(buildCompositeKey(ownerId, idempotencyKey));
}

/**
 * Marks an idempotency key as currently in-flight.
 */
export function setOperationInProgress(
  ownerId: string,
  idempotencyKey: string | undefined | null
): void {
  if (!idempotencyKey || typeof idempotencyKey !== 'string' || !idempotencyKey.trim()) {
    return;
  }
  inFlightOperations.add(buildCompositeKey(ownerId, idempotencyKey));
}

/**
 * Clears in-flight marker for an idempotency key.
 */
export function clearOperationInProgress(
  ownerId: string,
  idempotencyKey: string | undefined | null
): void {
  if (!idempotencyKey || typeof idempotencyKey !== 'string' || !idempotencyKey.trim()) {
    return;
  }
  inFlightOperations.delete(buildCompositeKey(ownerId, idempotencyKey));
}

/**
 * Clears the idempotency cache (used for test isolation).
 */
export function clearIdempotencyStore(): void {
  idempotencyStore.clear();
  inFlightOperations.clear();
}

export const clearIdempotencyCache = clearIdempotencyStore;
