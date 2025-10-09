/**
 * A/B testing client for Phase 50.2 sticky bucket assignment
 */

const VISITOR_ID_KEY = "visitor_id";
const BUCKET_KEY = "ab_bucket";

/**
 * Get or generate a stable visitor ID
 */
export function getVisitorId(): string {
  let vid = localStorage.getItem(VISITOR_ID_KEY);
  if (!vid) {
    vid = crypto.randomUUID();
    localStorage.setItem(VISITOR_ID_KEY, vid);
    // Also set cookie for backend tracking
    document.cookie = `${VISITOR_ID_KEY}=${vid}; max-age=31536000; path=/`;
  }
  return vid;
}

/**
 * Get current bucket from cache
 */
export function currentBucket(): "A" | "B" | null {
  const cached = localStorage.getItem(BUCKET_KEY);
  if (cached === "A" || cached === "B") return cached;
  return null;
}

/**
 * Fetch and cache bucket assignment from backend
 */
export async function getBucket(): Promise<"A" | "B"> {
  const cached = currentBucket();
  if (cached) return cached;

  try {
    const visitorId = getVisitorId();
    const res = await fetch(`/agent/ab/assign?visitor_id=${visitorId}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json();
    const bucket = json.bucket as "A" | "B";
    localStorage.setItem(BUCKET_KEY, bucket);
    return bucket;
  } catch (e) {
    console.error("Failed to get bucket assignment:", e);
    // Fallback to random if backend fails
    const fallback = Math.random() < 0.5 ? "A" : "B";
    localStorage.setItem(BUCKET_KEY, fallback);
    return fallback;
  }
}

/**
 * Fire an A/B test event (view or click)
 */
export async function fireAbEvent(event: "view" | "click") {
  const bucket = currentBucket() || (await getBucket());

  try {
    await fetch(`/agent/ab/event/${bucket}/${event}`, { method: "POST" });

    // Show toast for click events
    if (event === "click") {
      window.dispatchEvent(
        new CustomEvent("siteagent:toast", {
          detail: { message: `Thanks! Counted your ${bucket} click.` },
        })
      );
    }
  } catch (e) {
    console.error("Failed to fire AB event:", e);
  }
}

/**
 * Initialize AB tracking on page load
 */
export async function initAbTracking() {
  // Ensure visitor has bucket assigned
  await getBucket();
  // Fire view event
  await fireAbEvent("view");
}
