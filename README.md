# Tutee Connect — Study in Singapore

The Singapore destination page. Country #8, built 2026-09-02 from the UK
fragments by the shared toolchain in `../_tooling/`.

```
index.html            the landing page          (generated — do not hand-edit)
universities.html     the directory page        (generated — do not hand-edit)
assets/js/*.js        main.js, services-data.js, universities-data.js
                                                (all generated)
api/enquiry.py        the enquiry -> email function (installed, byte-identical
                      to _tooling/serverless/enquiry.py)
assets/img/photos/CREDITS.md   photo licences and the exact crops used
serve.py              static preview server (returns 501 for the form POST)
```

**Everything here is generated.** Editing `index.html` gets overwritten on the
next build. Edit `../_tooling/localise_sg.py` (copy), or
`../_tooling/build_dataset_sg.py` (the institution dataset), and rebuild:

```bash
cd "../_tooling"
python3 build_dataset_sg.py          # dataset from the vendored register snapshots
python3 build_dataset_sg.py --refresh    # ...re-downloading every source first
python3 localise_sg.py               # fragments-singapore/ + main.js + services-data.js
python3 assemble.py singapore
python3 build_unipage.py singapore
python3 verify_site.py singapore
python3 check_twins.py singapore     # what the localiser left unlocalised (baseline 40)
```

Preview at <http://localhost:8007> via `Start All Sites.command`, or
`python3 ../_tooling/devserver.py singapore --port 8007` (use `devserver.py`, not
`serve.py`, if you need the enquiry form to POST).

---

## The directory: 126 institutions, and why it is exactly the right list

Singapore has no single register like Australia's CRICOS. It has two
authorities, and between them they enumerate every institution at which ICA will
issue a Student's Pass:

1. **ICA names the public institutions itself** — the 6 autonomous
   universities, the 5 polytechnics, ITE, and 6 offshore institutes with local
   campuses (<https://www.ica.gov.sg/reside/STP/apply/ihl>).
2. **For a private institution, EduTrust certification IS the permission**, and
   ICA says so in both directions:

   > Only EduTrust-certified PEIs can offer placements to foreign students. … A
   > Student's Pass will not be issued to foreigners enrolled in PEIs that are
   > not EduTrust-certified.

   Current status is published per institution in the Committee for Private
   Education's **PEI Course Directory** — 321 registered PEIs, 6,770 registered
   courses, **141 EduTrust-certified**, data as of 01 Sep 2026.

So the cards' hardcoded `Intl. Admits: Yes` is exactly true here and is not an
inference.

| tier | n |
|---|---|
| Autonomous University | 6 |
| Polytechnic | 5 |
| ITE | 1 |
| Offshore Campus | 6 |
| Arts Institution | 2 |
| Higher Education (PEI with a degree registration) | 66 |
| Vocational (PEI, diploma and certificate only) | 40 |
| **total** | **126** |

**Two exclusions, both about what the page's copy would otherwise misdescribe:**

- the 180 registered PEIs with no EduTrust certification — they cannot enrol a
  foreign student at all;
- 34 EduTrust-certified PEIs whose entire registered inventory is school-level
  (Dulwich College, Stamford American, Overseas Family School and the like).
  They can host a Student's Pass, but this page's tertiary copy would
  misdescribe a K-12 school. Same rule Australia applies to CRICOS's
  school-sector-only providers.

`stpBasis` replaces the UK page's invented `offerRate` with a real published
value — the institution's current EduTrust award, or `ICA-listed IHL`. It is
rendered **"Student's Pass:"** and **is not a selectivity figure.**

## Known issue to close before launch: LASALLE

**LASALLE College of the Arts is the one entry whose Student's Pass basis could
not be established from an authoritative source.** The 01 Sep 2026 register
shows it holding **no EduTrust award** — while its own website still advertises
an EduTrust Star. Its sibling college NAFA (both are constituent colleges of the
University of the Arts Singapore) does hold a current EduTrust 4-Year award.

Read strictly, the ICA rule would exclude LASALLE. It is **included** anyway,
because it is a publicly funded post-secondary institution whose degrees are
validated by UAS, it actively recruits international students, and its own
admissions pages send them to SOLAR+. Its `stpBasis` says
`Publicly funded (UAS)` rather than claiming an EduTrust it does not currently
hold. **Confirm with SSG or ICA before launch** and, if it is wrong either way,
change `ARTS` in `build_dataset_sg.py`.

## Eight of the twelve carousel cards are rebadged

The home-page carousel renders twelve cards, each with a hardcoded `Rank #N`
badge in the reference DOM. **QS World University Rankings 2027 covers only four
Singapore institutions** — NUS #10, NTU #12, SUTD #266, SMU #411 — and **no
published table reaches a fifth**: SIT and SUSS have never been assessed by QS,
QS Asia adds nobody, and no ranking covers a polytechnic. Singapore has only six
universities in total, so unlike Ireland there is no regional table to fall back
on.

Cards 5–12 therefore show the institution's real category instead of a rank it
does not hold: `University` (SIT, SUSS), `Polytechnic` (×5), `ITE`. This is a
**text-node change only** — the tag, every class and every animation are
untouched, which the skeleton diff in `localise_sg.py` proves. Same fix New
Zealand needed for its cards 9–12.

`Autonomous University` is shortened to `University` **for the badge only**: it
is the one label that wraps in the fixed-width pill, which made those two cards
6 px taller than the other ten. The dataset `type` is unchanged, so the
directory chip still reads "Autonomous University".

## Three things about Singapore the copy had to contradict, not adapt

The UK page assumes three things that are false here, and getting them wrong
would misinform a reader who acts on them:

1. **A Student's Pass carries no dependant privileges at all** — not a narrower
   version of the UK's dependant visa, none. Family need their own Visit Pass.
   The routes that exist are all post-graduation: a Dependant's Pass for the
   spouse and children under 21 of an Employment Pass holder earning at least
   S$6,000/month.
2. **Part-time work is conditional, not a right.** 16 hours a week in term time,
   and uncapped in vacation, **only** at institutions on MOM's specified list —
   essentially the autonomous universities, the polytechnics and ITE. Students
   at most private institutions may not work at all. `check_twins.py` caught the
   blanket claim "Our students typically secure part-time roles within their
   first 30 days of arrival", which is now qualified.
3. **There is no post-study work visa.** A graduate of an Institute of Higher
   Learning may get a **one-year Long-Term Visit Pass to look for work, on which
   they may not work**, and must convert to an Employment Pass (from
   S$5,600/month, 40 COMPASS points) before starting a job.

And one that works in Singapore's favour, which no other page in the set has:
**the MOE Tuition Grant is open to international students** and roughly halves
tuition, in exchange for a three-year bond working for an ACRA-registered
Singapore employer. At NUS in AY2026/27 that is about S$21,000–S$30,000 a year
for most programs against about S$33,000–S$45,000 without it. It is the
`#scholarships` headline and the reason the settlement copy works.

There is also **no credibility interview** and **no immigration language test** —
ICA sets neither. The mock-interview and SELT promises are retargeted at SOLAR
registration, the IPA, the medical examination and the institutions' own IELTS /
TOEFL / PTE requirements.

## Other things worth knowing

- **Spelling is `program`, not `programme`** (as on the Canadian and Australian
  pages), and `programme` is a `verify_site.py` leak pattern here. `-ise`
  endings stay.
- **`swap_currency` is `False`** — Singapore uses dollars, so the reference's own
  lucide dollar icons are correct. That covers the HTML only, so
  `localise_sg.py` swaps the pound glyph in `services-data.js` back to the dollar
  one and asserts no pound survives. Canada never did this and still renders a £
  on a dollar page.
- **`location` is `<URA planning area>, Singapore`.** A city-state has no
  sub-national region to name, so the planning area is what carries information.
  It is resolved from the register's own address: postcode → WGS84 point (SLA
  OneMap) → point-in-polygon against URA's Master Plan 2019 boundaries. The URA
  planning *region* goes in `alt` so it stays searchable. **Three register
  entries publish no address at all** and honestly carry a bare "Singapore";
  `region_only_ok` in `verify_site.py` is what lets them through, and only this
  country sets it.
- Two register quirks that cost real time: **two addresses carry a five-digit
  postcode** because the leading zero was dropped at the source (6 Raffles Quay
  as "48580"), and **one course is registered with a blank Level**. Both are
  handled and asserted, so a register update that changes either fails the build
  instead of silently dropping rows.
- **`programs` is the only derived field.** For the 108 register entries it is
  the three commonest fields of study across that institution's own registered
  course titles; the keyword classification is ours. The 18 ICA-listed
  institutions the register does not cover carry a short editorial statement of
  scope — the only editorial strings in the dataset.
- **277 of the register's 321 names are ALL CAPS** because that is how they
  were registered — 99 of them among the entries kept here. They are
  title-cased for display, with an acronym allow-list (`KEEP_CAPS`) so `PSB`,
  `MDIS`, `LSBF`, `SSTC` and friends survive. Australia deliberately did *not*
  re-case its 125; here it is safe because the allow-list is asserted by eye
  against the rendered directory.
- `serve.py` here is **static-only** and returns 501 for the enquiry form's POST.
  Only `_tooling/devserver.py` serves `/api/enquiry`, and so does Vercel — see
  `../_tooling/ENQUIRY_SETUP.md`.

## Verified

- `verify_site.py singapore` — all checks pass; so do the other seven.
- A clean rebuild reproduces these files, and **all seven existing pages still
  rebuild byte-for-byte** after the toolchain changes this country needed.
- `index.html` is **1850 elements and differs from `AUSTRALIA/index.html` by
  exactly one token** — the city-image class. `universities.html` is 402
  elements with **zero** differences from any other page.
- All ten animation token counts match all seven other pages on both pages, and
  the two `IntersectionObserver` blocks in `main.js` are byte-identical across
  all eight sites.
- `grep -o '\*\*' index.html | wc -l` is 0 — no markdown leaked into a text node.
- `check_twins.py singapore` is 40, all reviewed as genuinely country-neutral.
