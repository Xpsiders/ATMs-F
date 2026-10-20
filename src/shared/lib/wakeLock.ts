type WakeLockSentinelLike = { release: () => Promise<void> };
type WakeLockLike = { request: (type: "screen") => Promise<WakeLockSentinelLike> };

export async function requestScreenWakeLock(nav: Navigator = navigator): Promise<WakeLockSentinelLike | null> {
  if (!("wakeLock" in nav)) return null;
  const wakeLock = (nav as Navigator & { wakeLock?: WakeLockLike }).wakeLock;
  if (!wakeLock) return null;
  return wakeLock.request("screen");
}
