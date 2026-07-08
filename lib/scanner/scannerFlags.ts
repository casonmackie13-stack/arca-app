/** Client-side scanner feature flags — safe to read during SSR (defaults to disabled). */
export function isOpenCvScannerEnabled(): boolean {
  return process.env.NEXT_PUBLIC_ENABLE_OPENCV_SCANNER === "true";
}
