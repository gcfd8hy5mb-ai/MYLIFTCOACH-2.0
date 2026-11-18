# Exercise catalog integration contract

This branch only prepares the public demo UI. It **does not** import the private approved images or claim the public app has 344 exercises yet.

Load a separate same-origin catalog script before `app.js` that assigns `window.MLC2_EXERCISE_CATALOG` as an array. Each exercise must have `id`, `name`, `group`, optional `sets`, `reps`, `cue`, and an optional `demonstration` object.

The demonstration object can be `{status:'approved',thumbnail:'assets/exercises/<id>.webp'}` **only after** matching an approved original/delivered checksum in the private manifest. For the 76 withheld exercises use `{status:'withheld'}`, or omit it, to display the generic charcoal-and-gold placeholder. Missing approved files also fall back to the placeholder. Do not embed private archive files into this public branch.

The public demo currently contains 12 starter exercises and read-only legacy records. The full private 344-ID catalog, 268 verified media files, and the original app migration still require an explicit, permitted import. Protect existing Supabase data; do not modify production records during import preparation.
