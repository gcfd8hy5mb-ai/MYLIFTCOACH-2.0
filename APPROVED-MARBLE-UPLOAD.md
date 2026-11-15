# Approved emerald marble source asset

The user approved the exact cropped 1198×590 photographic marble image shared in the MYLIFTCOACH 2.0 design conversation on November 15, 2026.

**Missing source file to upload manually:** `assets/approved-marble.jpg`

The approved image is prepared as a downloadable `approved-marble.jpg` conversation artifact and has **not yet** been uploaded to this GitHub repository. The connected GitHub API tools available during this session can upload UTF-8 text, but could not directly transfer the binary bytes of the user's image. Do not claim the image is live until this exact file is present in `main/assets/`.

## One-time upload
1. Download the provided `approved-marble.jpg` attachment from the ChatGPT conversation.
2. In this repository, open `assets/` and use **Add file → Upload files**.
3. Upload `approved-marble.jpg` with exactly that file name and commit to `main`.
4. GitHub Pages will publish automatically.

The existing `home-rebuild.css`, `premium-reference.css` and `refinement-v2.css` have been modified **in place** to prefer `assets/approved-marble.jpg?v=8` as their background image with `assets/emerald-marble-photo.jpg?v=7` retained as a temporary fallback. Because JPEG files are opaque, this fallback does not add a visible overlay or cover on top of the approved image. No new stylesheet has been added.

After this file is confirmed in GitHub, remove the fallback sources in the same stylesheets (optional cleanup), inspect the website on iPhone Safari, and confirm readability with the real marble texture. Leave original production app and Supabase records untouched.
