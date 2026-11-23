'use strict';

// Updates the installed 2.0 shell without clearing account storage or drafts.
// A running workout or other open dialog is never interrupted by a reload.
if ('serviceWorker' in navigator) {
 let refreshing = false;
 let pendingRefresh = false;
 let lastCheck = 0;
 const dialogBusy = () => {
  const modal = document.getElementById('modal');
  return !!(modal && !modal.hidden);
 };
 const refreshWhenSafe = () => {
  if (!pendingRefresh || refreshing || document.hidden || dialogBusy()) return;
  refreshing = true;
  location.reload();
 };
 const check = registration => {
  if (Date.now() - lastCheck < 15000) return;
  lastCheck = Date.now();
  registration.update().catch(() => {
   // Offline users continue with the last successfully installed shell.
  });
 };
 const hadController = !!navigator.serviceWorker.controller;
 navigator.serviceWorker.addEventListener('controllerchange', () => {
  if (!hadController) return; // First install; do not surprise a new user.
  pendingRefresh = true;
  refreshWhenSafe();
 });
 navigator.serviceWorker.register('./offline-worker.js', {updateViaCache:'none'})
  .then(registration => {
   check(registration);
   document.addEventListener('visibilitychange', () => {
    if (!document.hidden) { check(registration); refreshWhenSafe(); }
   });
   window.addEventListener('pageshow', () => {
    check(registration);
    refreshWhenSafe();
   });
   document.addEventListener('click', () => {
    // If a prior update arrived mid-workout, defer until dialog closes.
    if (pendingRefresh) queueMicrotask(refreshWhenSafe);
   });
  }).catch(() => {
   // Network failures never affect workouts, authentication, or cloud data.
  });
}
