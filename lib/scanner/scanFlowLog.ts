/** Temporary diagnostics for the Add → scanner capture path. */
export function scanFlowLog(label: string, detail?: unknown) {
  if (detail === undefined) {
    console.info(`[ARCA_SCAN_FLOW] ${label}`);
    return;
  }
  console.info(`[ARCA_SCAN_FLOW] ${label}`, detail);
}
