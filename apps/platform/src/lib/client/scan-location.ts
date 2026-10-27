"use client";

import {
  SCAN_LOCATION_MAX_AGE_MS,
  SCAN_LOCATION_TIMEOUT_MS,
  captureErrorOf,
  type ScanCapture,
} from "@/lib/scan-location";

// The phone's position at the moment of a QR scan (part 20). Asked once per scan,
// in the background: opening the device never waits for it. No tracking: nothing
// runs between scans.

const EXPLAINED_KEY = "sd_scan_location_explained";

/**
 * Our own limit on top of the browser's: the browser's timeout starts only once
 * the permission is granted, and some browsers never answer when the permission
 * prompt is dismissed. Long enough to read and answer the prompt.
 */
const OUTER_LIMIT_MS = 30_000;

/** The technician has read why the position is recorded (asked once per phone). */
export function scanLocationExplained(): boolean {
  try {
    return localStorage.getItem(EXPLAINED_KEY) === "1";
  } catch {
    return true;
  }
}

export function markScanLocationExplained() {
  try {
    localStorage.setItem(EXPLAINED_KEY, "1");
  } catch {
    // Storage blocked: the explanation shows again next time.
  }
}

/** The position now, or why there is none. Never rejects. */
export function captureScanLocation(): Promise<ScanCapture> {
  const now = () => new Date().toISOString();
  if (typeof navigator === "undefined" || !("geolocation" in navigator))
    return Promise.resolve({ error: "unsupported", capturedAt: now() });
  return new Promise((resolve) => {
    let settled = false;
    const done = (capture: ScanCapture) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(capture);
    };
    const timer = setTimeout(() => done({ error: "timeout", capturedAt: now() }), OUTER_LIMIT_MS);
    try {
      navigator.geolocation.getCurrentPosition(
        (position) =>
          done({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            accuracyM: Math.round(position.coords.accuracy * 10) / 10,
            capturedAt: new Date(position.timestamp || Date.now()).toISOString(),
          }),
        (error) => done({ error: captureErrorOf(error.code), capturedAt: now() }),
        {
          enableHighAccuracy: true,
          timeout: SCAN_LOCATION_TIMEOUT_MS,
          maximumAge: SCAN_LOCATION_MAX_AGE_MS,
        },
      );
    } catch {
      // Blocked by the page's permissions policy.
      done({ error: "denied", capturedAt: now() });
    }
  });
}
