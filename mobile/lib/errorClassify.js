// Tiny shared error classifier used by both `db.js` (to decide
// whether to retry) and `errorBuffer.js` (to tag entries by kind).
// Lives in its own file so the two modules can both import it
// without forming a circular dependency.

/**
 * True when an error matches the EMUI/HyperOS "native SQLite handle
 * has been torn out" failure mode — every op then rejects with
 * either a raw `java.lang.NullPointerException` or one of the
 * expo-sqlite wrapper messages
 * (`Call to function 'NativeDatabase.prepareAsync' has been
 * rejected`, `'NativeStatement.runAsync' has been rejected`).
 *
 * Anything else (validation, "no such table", unique-constraint,
 * JSON.parse failures, etc.) returns false so the retry / classifier
 * doesn't paper over real bugs.
 */
export function isNativeHandleError(err) {
  if (!err) return false;
  const msg = String(err?.message || err || '');
  return (
    /NullPointerException/i.test(msg) ||
    /NativeDatabase\.\w+\b.*has been rejected/i.test(msg) ||
    /NativeStatement\.\w+\b.*has been rejected/i.test(msg)
  );
}
