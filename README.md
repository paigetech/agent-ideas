# Still

A single quiet page that shows one beautiful real place, full screen. Click
anywhere to go somewhere new.

It exists to scratch the "give me something new" itch without a feed attached.
There is no scroll, no next-up rail, no like count, no recommendations, and
nothing that gets better the longer you stay. One photo, one click, and the
only thing that ever happens is another photograph.

## Try it

Open `index.html` in a browser. That's the whole install — no build step, no
dependencies, no API key, no account.

```
git clone https://github.com/paigetech/agent-ideas.git
open agent-ideas/index.html          # macOS
xdg-open agent-ideas/index.html      # Linux
```

To use it on a phone, push this repo to GitHub Pages (Settings → Pages → deploy
from `main`) and add the URL to your home screen. It runs fullscreen from there
like an app.

## Using it

| | |
|---|---|
| click / tap anywhere | somewhere new |
| `space`, `enter`, `→` | somewhere new |
| `b` | breathing guide on / off |
| `c` | fill the screen / fit the whole photo |
| `f` | fullscreen |

The controls fade out after a couple of seconds of stillness, leaving only the
photograph. Move the mouse to bring them back.

**The breathing guide** is a slow ring: roughly four seconds expanding, six
contracting. It's a long exhale, which is the part that actually settles you.

**Fill vs. fit** matters more than it sounds. Fill is more immersive but crops
the top and bottom, which can behead a mountain. Press `c` when a photo
deserves its full frame.

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
  keeps you clicking. The only network requests are to Commons for photos.
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

- **The next photo is already downloaded** before you click, so a click is an
  instant crossfade rather than a spinner. A wait is exactly where a restless
  brain goes looking for another tab.
- **The photo element is moved into the page**, not re-requested by URL, so a
  verified-good photo can never render as a broken frame.
- **The interface disappears** when you stop moving. Most of the time there is
  nothing on screen but the place.
- **Nothing counts anything.** No streak, no history, no total. Closing the tab
  costs you nothing, which is the point.
- Photos don't repeat within a session.
- `prefers-reduced-motion` shortens the crossfade.

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

## Tests

Browser tests cover the queue and preloading, the metadata filtering, degraded
network conditions, the check-in timer, and phone layout. They mock the Commons
API so they run without a network and don't hit Wikimedia's servers.

```
npm install
npx playwright install chromium
npm test
```

Playwright is the only dependency, and only for the tests — the app itself has
none.
