/**
 * Firestore Read Logger - Development Instrumentation
 * Tracks Firestore read operations, returned document counts, and elapsed time per API call.
 * 
 * Safety & Privacy:
 * - Never logs document contents
 * - Never logs sensitive data (tokens, passwords, user private fields)
 * - Development-only by default (controlled via NODE_ENV !== "production" or ENABLE_FIRESTORE_READ_LOGS=true)
 */

export interface FirestoreReadLogEntry {
  apiPath: string;
  operation: string;
  documents: number;
  durationMs: number;
  timestamp: number;
}

// In-memory log history for testing and verification (e.g. Step 12)
const readLogHistory: FirestoreReadLogEntry[] = [];

/**
 * Checks if read logging is active.
 * Enabled in non-production environments or when ENABLE_FIRESTORE_READ_LOGS === "true".
 */
export function isReadLoggingEnabled(): boolean {
  return (
    process.env.NODE_ENV !== "production" ||
    process.env.ENABLE_FIRESTORE_READ_LOGS === "true"
  );
}

/**
 * Measures and logs a Firestore read operation.
 * 
 * @param apiPath - HTTP Method and Path, e.g. "GET /api/dungeon/queues"
 * @param operation - Firestore operation descriptor, e.g. "queues query"
 * @param fn - The async function executing the Firestore query/read
 * @param countExtractor - Optional custom callback to extract returned doc count
 */
export async function trackFirestoreRead<T>(
  apiPath: string,
  operation: string,
  fn: () => Promise<T>,
  countExtractor?: (result: T) => number
): Promise<T> {
  if (!isReadLoggingEnabled()) {
    return await fn();
  }

  const startTime = performance.now();
  const result = await fn();
  const elapsedMs = Math.round(performance.now() - startTime);

  let docCount = 0;
  if (countExtractor) {
    docCount = countExtractor(result);
  } else if (result && typeof result === "object") {
    if ("docs" in result && Array.isArray((result as any).docs)) {
      docCount = (result as any).docs.length;
    } else if ("exists" in result && typeof (result as any).exists === "boolean") {
      docCount = (result as any).exists ? 1 : 0;
    } else if (Array.isArray(result)) {
      docCount = result.length;
    }
  }

  const logEntry: FirestoreReadLogEntry = {
    apiPath,
    operation,
    documents: docCount,
    durationMs: elapsedMs,
    timestamp: Date.now(),
  };

  readLogHistory.push(logEntry);

  // Formatted console output matching required specification
  console.log(
    `\n[Firestore Read Log]\n${apiPath}\nFirestore:\n${operation}\ndocuments: ${docCount}\nduration: ${elapsedMs}ms`
  );

  return result;
}

/**
 * Returns recorded read log entries (for diagnostics / Step 12 verification).
 */
export function getFirestoreReadLogs(): FirestoreReadLogEntry[] {
  return [...readLogHistory];
}

/**
 * Clears recorded read log entries.
 */
export function clearFirestoreReadLogs(): void {
  readLogHistory.length = 0;
}
