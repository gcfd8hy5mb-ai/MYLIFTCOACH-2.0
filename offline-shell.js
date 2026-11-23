'use strict';

// Check for updates while keeping the current document and its edits intact.
if ('serviceWorker' in navigator) {
 let lastCheck = -Infinity;
 const check = registration => {
  if (Date.now() - lastCheck < 15000) return;
  lastCheck = Date.now();
  registration.update().catch(() => {
   // Offline users continue with the last successfully installed shell.
  });
 };
 navigator.serviceWorker.register('./offline-worker.js', {updateViaCache:'none'})
  .then(registration => {
   check(registration);
   document.addEventListener('visibilitychange', () => {
    if (!document.hidden) check(registration);
   });
   window.addEventListener('pageshow', () => check(registration));
  }).catch(() => {
   // Network failures never affect workouts, authentication, or cloud data.
  });
}
