# MYLIFTCOACH 344 exercise visuals

Image-only release instructions. No Coach, cloud, or workout changes.

1. Extract `MYLIFTCOACH_344_Images_Ready_For_Private_Hosting.zip` at the repository root of this branch. Preserve `assets/exercise-demonstrations/` and `assets/image-coming-approved.webp` paths exactly.
2. The ZIP's `approved-visuals-manifest.js` must load **after** `exercise-catalog-344.js` and **before** `exercise-visuals-344.js`. Insert `<script defer src="./approved-visuals-manifest.js?v=1"></script>` between those scripts in `index.html`.
3. `exercise-visuals-344.js` enables the 263 approved image mappings only when the catalog has exactly 344 exercise records and the manifest has exactly 263 valid unique mapped IDs. All other exercises show the approved `IMAGE COMING` placeholder.
4. Check 263 approved thumbnails, 81 placeholders, missing-file requests, and existing application functionality on phone and desktop before merging to a deployed branch.
5. Do not publish until both image inventory and browser visual checks pass.

The ZIP is a separate conversation attachment, not a file currently present in this repository. This commit does not upload images or deploy a release.
