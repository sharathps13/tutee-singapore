# Photo credits

All four photographs are Singapore subjects sourced from Wikimedia Commons. Two
are **CC BY**, which makes the footer credit line a licence obligation rather
than a courtesy; the other two are **CC0** and are credited anyway, as on the
other pages. The line is rendered from the `data-photo-credit` element and
generated from `PHOTO_CREDIT` in `_tooling/localise_sg.py`. If you swap any
photo, update this file **and** that constant, then re-run `localise_sg.py`,
`assemble.py singapore` and `build_unipage.py singapore`.

CC BY-SA, NC and ND images were deliberately avoided, as on the other seven
pages. That rule cost several otherwise ideal candidates here: almost every
high-resolution frame of NTU's Learning Hub ("The Hive") on Commons is CC BY-SA,
and so are the best Marina Bay night skylines.

**Revision, 2026-09-02:** the hero and the settlement panel originally carried
campus photographs — the Li Ka Shing Library at SMU and the NUS University
Town entrance sign. Both were replaced at the client's request with recognisable
Singapore landmarks. The education framing in the hero is now carried entirely
by the copy and the overlay card ("Singapore Education Experts", "Top Singapore
Institutions"), not by the image.

Each file was cropped and resized from the Commons original with `sips`. The
output dimensions match the French, Australian, New Zealand, German, Irish and
Canadian files, which in turn match the slots, so the layout cannot shift.

**No photograph has an identifiable person as its subject** — the same rule the
other seven pages follow. The Marina Bay Sands and CBD frames are empty of
people. The Gardens by the Bay frame has visitors on the walkway roughly a
hundred metres away. The Jewel Changi frame is the closest call in the set: it
carries a crowd on the atrium floor and figures on the canopy walkway, but they
are incidental to a subject that is unmistakably the Rain Vortex, and at the
delivered 1200 px — rendered at about 596 px — no face is resolvable. This is
the same judgement the French page's Place de la Sorbonne hero rests on.

---

## students-campus.jpg — hero (`#home`), 1200×1143

> **The filename does not describe the subject**, and it is kept because
> `students-campus.jpg` is a literal key in the compiled stylesheet — the class
> `bg-[url('/assets/img/photos/students-campus.jpg')]` plus the matching escaped
> selector and `url()` in `assets/css/main.css`, and the `<link rel="preload">`
> in the page shell. Renaming the file means editing all of those together;
> `verify_site.py` fails on a mismatch, the browser fails silently.

- **Depicts:** the HSBC Rain Vortex under the glass canopy of Jewel Changi
  Airport, with the Shiseido Forest Valley terraces and the Skytrain crossing
  the atrium.
- **Commons file page:** https://commons.wikimedia.org/wiki/File:Jewel_Changi_(II).jpg
- **Author / photographer:** Supanut Arunoprayote
- **Licence:** CC BY 4.0 — https://creativecommons.org/licenses/by/4.0
- **Attribution required:** **yes**
- **Crop:** original 6643×4454 (1.491:1) → `sips -c 4454 4676` (1.0499:1,
  centred) → resized to 1200×1143, quality 82.
- **Why a centred crop is right here:** the photographer squared up on the
  vortex, so the canopy apex, the falling water and the basin all sit on the
  frame's vertical axis. The 983 px trimmed from each side is foliage that
  repeats, so nothing identifiable is lost.
- **Why 1.05:1 and not the original 3:2:** the hero panel measures about
  **596×584 CSS px on desktop (1.02:1) and 319×292 on mobile (1.09:1)** —
  essentially square at every breakpoint. The div is `bg-cover bg-center`, so a
  1.5:1 file would have a third of its width thrown away. A near-square crop
  suits this subject unusually well, because the vortex is a vertical column.
- **Safe to reshape:** referenced only as a CSS `background-image` and a
  `<link rel="preload">` — there is no `<img>` tag for it on either page, so its
  ratio has no effect on layout.

## team-working.jpg — `#relocate` ("The Pathway to Settlement"), 1400×933

- **Depicts:** Marina Bay Sands seen in elevation from across the water to the
  west, with the SkyPark and the Shoppes podium.
- **Commons file page:** https://commons.wikimedia.org/wiki/File:Marina_Bay_Sands_(I).jpg
- **Author / photographer:** Supanut Arunoprayote
- **Licence:** CC BY 4.0 — https://creativecommons.org/licenses/by/4.0
- **Attribution required:** **yes**
- **Crop:** **none.** The original is 6366×4244, which is 3:2 to within a
  pixel, so it was only resized to 1400×933 at quality 82. Nothing is cropped
  away.
- **Note:** this image is rendered with `w-full h-auto object-cover`, so **its
  aspect ratio drives the layout**. Any replacement must also be 3:2. That the
  source was already exactly 3:2 is why this is the only file in the set with no
  crop step.

## family.jpg — `#relocate` ("Relocating with Your Family?"), 1400×1050

- **Depicts:** the Supertree Grove and the Flower Dome at Gardens by the Bay.
- **Commons file page:** https://commons.wikimedia.org/wiki/File:20190819_Gardens_by_the_Bay_Supertree_Grove-3.jpg
- **Author / photographer:** Balon Greyjoy
- **Licence:** CC0 — https://creativecommons.org/publicdomain/zero/1.0
- **Attribution required:** no (credited anyway)
- **Crop:** original 5760×3840 (3:2) → `sips -c 3840 5120` (exact 4:3, centred)
  → resized to 1400×1050, quality 82. Centred is load-bearing here for a
  compositional reason rather than a subject one: the Flower Dome is at the far
  left of the frame and the Supertrees at the far right, so trimming 320 px from
  each side is the widest window that keeps **both** landmarks. Cropping harder
  to either side loses one of them.

## singapore-city.jpg — `#universities` ("Why Singapore?") background panel, 1400×933

> Referenced by the Tailwind arbitrary-value class
> `bg-[url('/assets/img/photos/singapore-city.jpg')]`, which is a **literal key**
> into `assets/css/main.css`. Both the class in the HTML and the escaped
> selector plus `url()` in the stylesheet must be changed together — this file
> was repointed from `france-city.jpg` when the shared CSS was copied over.

- **Depicts:** the Central Business District skyline seen across Marina Bay.
- **Commons file page:** https://commons.wikimedia.org/wiki/File:Skyline_of_Singapore_Central_Business_District_20250903.jpg
- **Author / photographer:** DvTor8303
- **Licence:** CC0 — https://creativecommons.org/publicdomain/zero/1.0
- **Attribution required:** no (credited anyway)
- **Crop:** original 8141×3271 (2.49:1 — a stitched panorama) →
  `sips -c 3271 4906` (exact 3:2, centred) → resized to 1400×933, quality 82.
  The panorama is far wider than the slot, and its centre holds the dense tower
  cluster; the discarded thirds are open water and low buildings.
- **Why the CBD skyline and not another Marina Bay Sands frame:** the
  settlement panel is now MBS itself, so this one deliberately looks the other
  way across the water. The other seven pages all spread their four images
  across at least three distinct areas; after the 2026-09-02 revision these four
  sit in **Changi, Marina Bay, Marina South and the CBD**.
