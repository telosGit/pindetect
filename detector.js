(async () => {
  // Register SW
  await navigator.serviceWorker.register('/pindetect/sw.js');
  await navigator.serviceWorker.ready;

  const log = [];
  let initialSettled = false;

  // --- Signal 1: favicon re-fetch burst ---
  navigator.serviceWorker.addEventListener('message', ev => {
    if (ev.data?.type !== 'favicon-hit') return;
    log.push(ev.data.t);

    // Ignore the first 1-2 hits after load (initial fetch)
    if (!initialSettled) return;

    // A pin/unpin typically causes 1 fetch with destination="image"
    // within milliseconds of a visibility-unrelated event.
    evaluate('favicon-refetch');
  });

  // Mark initial load as settled after 2s of quiet
  let quiet;
  const markSettled = () => {
    clearTimeout(quiet);
    quiet = setTimeout(() => { initialSettled = true; }, 2000);
  };
  markSettled();
  navigator.serviceWorker.addEventListener('message', markSettled);

  // --- Signal 2: force a re-fetch to probe current state ---
  // Changing the href forces Chrome to request. Pinned tabs fetch
  // with a specific Sec-Fetch-Dest=image and sometimes an extra
  // high-DPI variant request.
  function probe() {
    const link = document.getElementById('favicon');
    link.href = `/favicon.svg?v=1&t=${Date.now()}`;
  }

  // --- Signal 3: timer throttling fingerprint ---
  // Background pinned tabs in Chrome are throttled HARDER than
  // normal background tabs (intensive wake-up throttling kicks
  // in faster). Measure clamp when hidden.
  let throttleScore = 0;
  async function measureThrottle() {
    if (!document.hidden) return;
    const start = performance.now();
    await new Promise(r => setTimeout(r, 1));
    const drift = performance.now() - start;
    // Normal bg tab: ~1-4ms. Pinned bg tab under load: often >=1000ms.
    if (drift > 900) throttleScore++;
    else throttleScore = Math.max(0, throttleScore - 1);
  }
  setInterval(measureThrottle, 2000);

  // --- Signal 4: window chrome height heuristic ---
  // Not bulletproof, but when the *only* tab is pinned, Chrome
  // still renders the tab strip the same, so this alone is weak.
  // Used only as a tiebreaker.
  function chromeHeight() {
    return window.outerHeight - window.innerHeight;
  }

  // --- Combine ---
  function evaluate(trigger) {
    // Heuristic scoring
    let score = 0;
    if (trigger === 'favicon-refetch') score += 2;
    if (throttleScore >= 2) score += 2;
    if (document.hidden) score += 1;         // pinned tabs spend more time hidden
    if (chromeHeight() < 90) score += 1;     // rough Chrome desktop band

    const verdict = score >= 3 ? 'LIKELY_PINNED'
                  : score >= 2 ? 'MAYBE_PINNED'
                  : 'LIKELY_NOT_PINNED';
    document.getElementById('status').textContent =
      `${verdict} (score ${score}, throttle ${throttleScore})`;
    window.dispatchEvent(new CustomEvent('pinstate', { detail: { verdict, score }}));
  }

  // Probe periodically so state changes get caught even if the user
  // never interacts. Chrome will only actually hit the SW when the
  // href changes AND the browser decides to refresh the icon — which
  // it reliably does on pin/unpin.
  setInterval(probe, 5000);

  // Initial verdict
  setTimeout(() => evaluate('init'), 3000);
})();
