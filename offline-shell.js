'use strict';

if ('serviceWorker' in navigator) {
 navigator.serviceWorker.register('./offline-worker.js').catch(() => {
  // The online app still works if offline storage is unavailable.
 });
}
