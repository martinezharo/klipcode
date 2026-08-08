/** Reject duplicate client ids before a sync/import mutation starts writing. */
export function assertUniqueClientIds(
  records: ReadonlyArray<{ clientId: string }>,
  recordType: string,
): void {
  const seen = new Set<string>();

  for (const record of records) {
    if (seen.has(record.clientId)) {
      throw new Error(`Duplicate ${recordType} clientId in batch`);
    }
    seen.add(record.clientId);
  }
}
