# Still

One beautiful real place, sitting on the desk as a 90s polaroid. Click anywhere
and the picture inside the frame develops into somewhere new.

It exists to scratch the "give me something new" itch without a feed attached.
There is no scroll, no next-up rail, no like count, no recommendations, and
nothing that gets better the longer you stay. One photo, one click, and the
only thing that ever happens is another photograph.

The frame never moves. It is a physical object on a neutral teal ground, and
only what is inside it changes — the picture clears to blank film and the new
one develops in, the way the real thing did. The place is written by hand on
the deep bottom border, with the photographer and licence underneath in the
same pen.

## Try it

Open `index.html` in a browser. That's the whole install — no build step, no
dependencies, no API key, no account.

```
git clone https://github.com/paigetech/agent-ideas.git
open agent-ideas/index.html          # macOS
xdg-open agent-ideas/index.html      # Linux
```

For a phone, deploy it (below) and add the URL to your home screen. It runs
fullscreen from there, with its own icon, like an app.

## Using it

| | |
|---|---|
| click / tap anywhere | somewhere new |
| `space`, `enter`, `→` | somewhere new |
| `b` | breathing guide on / off |
| `c` | crop to the frame / fit the whole photo |
| `f` | fullscreen |

The controls fade out after a couple of seconds of stillness, leaving only the
polaroid. Move the mouse to bring them back.

**The breathing guide** is a slow halo behind the photo: roughly four seconds
expanding, six contracting. It's a long exhale, which is the part that actually
settles you. It sits behind the frame rather than over it, so it never competes
with the thing you are meant to be looking at.

**Crop vs. fit** matters more here than it would elsewhere. A Polaroid 600's
image area is 3.108in x 3.024in — very nearly square — so a wide landscape gets
cropped hard to fill it. That is the format being honest rather than a bug, but
press `c` when a photo deserves its whole frame and it will sit letterboxed on
blank film instead.

## The one deliberate interruption

After fifteen minutes of *active* looking, a small note appears once: "You've
been here 15 minutes. Still what you need right now?" Then it goes away and
never returns for that session. Time with the tab in the background doesn't
count.

It is a check-in, not a limit, and not a scold. The honest answer is sometimes
yes — fifteen minutes of quiet is a fine thing to have spent them on. The point
is to make the choice conscious once, which is the thing a feed never does.

To change the timing or turn it off, edit `CHECKIN_AFTER` near the top of the
script in `index.html`.

## Where the photos come from

[Wikimedia Commons](https://commons.wikimedia.org), drawing only from its
**Featured pictures** and **Quality images** categories — both human-curated, so
the baseline is genuinely high. Every photo is freely licensed, and the
photographer and licence are credited in the corner with a link to the original.

This choice does a lot of work:

- **No API key and no account.** Nothing to sign up for, nothing to rotate,
  nothing to leak. Clone and open.
- **Nobody is watching.** No analytics, no ad tech, no recommender learning what
  keeps you clicking. The only network requests in the whole app are to Commons
  for photos — the handwriting font is embedded in the page, so not even a font
  CDN sees you.
- **Nothing is trying to keep you.** The source has no engagement stake in you.

Categories are listed in `CANDIDATE_CATEGORIES` at the top of the script. Names
on Commons drift over time, so the app asks Commons which of them actually exist
before using any, caches that answer for a month, and quietly ignores the rest.
Add whatever you like to the list — deserts, glaciers, caves, storms. Anything
that doesn't resolve is skipped rather than breaking.

Some filtering happens client-side: only real photographs at least 1200px wide,
skipping the maps, diagrams and paintings that live in those categories too.

## How it stays calm

Small decisions, but they're most of the feel:

- **The next photo is already downloaded** before you click, so the develop
  animation is decoration over pixels that are already there, not a spinner
  dressed up. A wait is exactly where a restless brain goes looking for another
  tab.
- **The photo element is moved into the page**, not re-requested by URL, so a
  verified-good photo can never render as a broken frame.
- **Only the picture changes.** The frame, its tilt and its shadow are never
  rebuilt, so nothing jumps between photos and your eye keeps its place.
- **The interface disappears** when you stop moving. Most of the time there is
  nothing on screen but the polaroid.
- **Nothing counts anything.** No streak, no history, no total. Closing the tab
  costs you nothing, which is the point.
- Photos don't repeat within a session.
- Images are requested at the size the frame can actually show, with headroom
  for the crop — not at screen size, and never the 40-megapixel original.
- `prefers-reduced-motion` skips the develop animation entirely.

## Known rough edges

It's a prototype, and these are the honest gaps:

- **No offline mode.** With no connection you get a plain message and a retry
  button, not a cached photo. Caching a handful for offline use would be the
  single biggest improvement.
- Photos repeat across sessions — the "already seen" list is per-session and
  lives in memory only.
- Commons captions are inconsistent: some photos get a real place name, others
  fall back to a tidied-up filename.
- A random Featured category is picked per batch, so a run can lean mountains
  for a while before it wanders.
- The frame's tilt is fixed. Re-tilting it per photo would be more lifelike but
  would also mean the one thing meant to hold still does not.

## Deploying

`.github/workflows/pages.yml` runs the tests on every push and pull request,
and publishes to GitHub Pages when they pass on `main`. It calls
`actions/configure-pages` with `enablement: true`, so the first successful run
turns Pages on by itself — there is no setting to go and find. The site lands at
`https://<user>.github.io/<repo>/`.

Only `index.html`, the icons, the manifest and the font licence are published.
`scripts/stage-site.sh` decides that, and `test/site.test.mjs` stages with the
same script and drives the result over HTTP under a subpath — so a relative path
that only works from `file://`, a missing asset, or anything reaching for a
third-party host fails CI rather than the live site.

**One thing to know first: Pages availability depends on the repository.** It is
free for public repositories. For a **private** repository it needs GitHub Pro,
Team or Enterprise — otherwise the deploy job fails when it tries to enable
Pages.

**And in every one of those cases the published site itself is public.** Making
a private repo's Pages site private requires Enterprise. Deploying does not
expose the repository, but it does put the page on the open web at a guessable
URL. For this app that is close to harmless — it is a photo viewer holding no
data of yours, and there is nothing to log in to — but it is worth deciding
rather than discovering.

If you would rather not publish at all, the app needs no server. Opening
`index.html` works, and syncing the folder to a phone works too.

## The handwriting

The caption is set in [Caveat](https://github.com/googlefonts/caveat), embedded
in `index.html` as a base64 WOFF2 rather than linked. That costs about 50KB and
buys three things: the handwriting looks identical on every machine, it works
with no network, and no third party gets a request. Relying on system faces
instead would have fallen back to a plain sans on Linux and Android, which
misses the point of a handwritten caption entirely.

Caveat is licensed under the SIL Open Font License 1.1, included at
`licenses/Caveat-OFL.txt`. System handwriting faces are kept in the stack as a
fallback in case the embedded font ever fails to load.

## Tests

Two browser suites, both mocking the Commons API so they run with no network
and never hit Wikimedia's servers.

`test/app.test.mjs` covers the queue and preloading, the metadata filtering, the
polaroid's geometry and the frame staying put between photos, degraded network
conditions, the check-in timer, and layout from a phone to a wide monitor.

`test/site.test.mjs` covers the published artifact: it stages the site with the
deploy script and serves it under a project-page subpath, checking the app runs
there, that every relative asset resolves, that nothing private is published,
and that no request goes to a third party.

```
npm install
npx playwright install chromium
npm test
```

Playwright is the only dependency, and only for the tests — the app itself has
none.
