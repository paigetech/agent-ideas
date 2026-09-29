# Carry — YouTube videos on an iPhone that has no YouTube

*Working name. Status: version zero (iCloud Drive → Files app, 1080p) is built;
see [README.md](README.md). Everything from the podcast feed onward is still
design only.*

## The problem

Paige keeps YouTube off the phone on purpose. But research videos keep turning
up — links from people, things found on the Mac — and there is no good way to
let exactly one of them onto the phone to watch or listen to on the go, without
also letting the whole feed back in.

What "solved" looks like:

- Hand Claude one URL or a list of them. Nothing else to do.
- The videos show up on the phone, playable offline, with audio that keeps
  going when the screen locks (this is the "listen on the go" half).
- The phone never touches youtube.com. No app, no site, no Screen Time hole.
- No feed, no recommendations, no autoplay-into-something-else.

## The decision

**Download on the Mac with yt-dlp, publish each video as an episode of a
private podcast feed, and subscribe to that feed in Apple Podcasts.**

Three findings drive this:

1. **The download has to happen on the Mac, not in a cloud session.** Tested
   from this Claude cloud container: yt-dlp resolves titles and formats, but
   the media download itself comes back `HTTP Error 403: Forbidden`. That is
   YouTube's standard block on datacenter IPs. A residential IP (the Mac at
   home or on a normal network) is not blocked. So the "skill" is a Claude Code
   skill that runs on the Mac, and anything cloud-side can only queue work.

2. **Apple Podcasts is the best "custom app" and it already exists.** It plays
   video episodes, keeps playing the audio when the phone locks, remembers
   position, does 0.5x–2x speed, downloads episodes automatically for offline,
   and takes any RSS URL via *Follow a Show by URL*. That is every requirement
   in the list above, in a first-party app, with no code on the phone.

3. **iCloud Drive alone is not quite enough, but it is the right day one.**
   Dropping an mp4 into iCloud Drive gets it to the Files app in minutes with
   zero infrastructure. The Files video player, though, has no speed control,
   no position memory, and stops when the screen locks. It is the fallback
   and the first thing to build, not the destination.

## Options considered

| Option | Gets video to phone | Background audio | Speed / resume | Offline | Setup cost | Verdict |
|---|---|---|---|---|---|---|
| iCloud Drive → Files app | yes, automatic | no | no | yes (once opened) | none | **Phase 0 fallback** |
| iCloud Drive → VLC / Infuse | yes, automatic | yes | yes | yes | install one app | good, but manual "open in" each time |
| **Private podcast feed → Apple Podcasts** | yes, automatic | yes | yes | yes, auto-download | ~1 hour once | **Recommended** |
| Private feed → Overcast | audio only | yes | best-in-class | yes | same as above | optional second feed for audio-only |
| Finder sync → Apple TV app | yes | no | resume only | yes | none | needs a cable or Wi-Fi sync each time; not "send and forget" |
| Plex / Jellyfin | yes | yes | yes | with effort | a media server | far more machinery than the problem needs |
| Custom iOS app | yes | yes | yes | yes | days, plus signing and TestFlight | rebuilds Apple Podcasts badly; only justified if Podcasts fails a hard requirement |

## How it works

```
  URL(s) ──▶ Claude Code skill on the Mac ──▶ carry add <url>...
                                                   │
                   ┌───────────────────────────────┘
                   ▼
   1. yt-dlp     download 720p H.264/AAC mp4, thumbnail, auto-subtitles, info json
   2. notes      Claude reads the transcript, writes a short summary + timestamps
   3. library    append episode to library.json (id, title, duration, size, added)
   4. feed       regenerate feed.xml from library.json (RSS 2.0 + itunes tags)
   5. publish    rclone sync episodes/ and feed.xml to the private bucket
   6. prune      drop oldest episodes past the retention cap, rebuild, re-sync
                   │
                   ▼
        https://<bucket>/<random-token>/feed.xml
                   │
                   ▼
   Apple Podcasts on the phone: Follow a Show by URL, auto-download on
```

### Download (yt-dlp on the Mac)

```
yt-dlp \
  -f "bv*[height<=720][vcodec^=avc1]+ba[ext=m4a]/b[height<=720][ext=mp4]" \
  --merge-output-format mp4 \
  --write-info-json --write-thumbnail --convert-thumbnails jpg \
  --write-auto-subs --sub-langs en --convert-subs srt \
  --embed-metadata --embed-thumbnail \
  -o "episodes/%(id)s/%(id)s.%(ext)s" \
  "$URL"
```

- `avc1` (H.264) and `m4a` (AAC) on purpose. YouTube's default best formats
  are VP9 or AV1, which iOS players handle unevenly. H.264 in mp4 plays
  everywhere Apple.
- 720p is the default. Rough sizes per hour of video: 480p ≈ 300 MB,
  720p ≈ 600–900 MB, audio-only ≈ 60 MB. Quality is a flag, not a rebuild.
- Requires `ffmpeg` (`brew install ffmpeg yt-dlp`). yt-dlp is a moving target
  because YouTube changes; `brew upgrade yt-dlp` is the first fix for any
  breakage.
- Optional audio-only sibling: `-f "ba[ext=m4a]" -x --audio-format m4a`, for
  a second "listen" feed if video files prove too heavy on cellular.

### Notes (the part that needs Claude)

Everything above is a shell script. Where Claude earns its place is that these
are *research* videos: after the download, the skill reads the `.en.srt`
transcript and writes `episodes/<id>/notes.md` with a three-to-five sentence
summary, the key claims, and a few `mm:ss` timestamps worth jumping to. The
feed builder puts that into the episode description, so the show notes in
Apple Podcasts say what the video is actually about before pressing play.

When the pipeline runs unattended (Phase 2), the notes step calls
`claude -p` headless with the transcript, or is skipped and the description is
just the title and the original link.

### The feed

`feed.xml` is generated, never edited, from `library.json`. One `<item>` per
episode:

- `<guid>` = YouTube video id, so re-adding a URL never duplicates.
- `<pubDate>` = when it was added, not when it was uploaded, so it sorts as
  new on the phone.
- `<enclosure url="…/episodes/<id>/<id>.mp4" type="video/mp4" length="…">`
- `<itunes:duration>`, `<itunes:image>` from the thumbnail, `<itunes:block>yes`
  so no directory ever lists it.
- `<description>` = notes.md as HTML, plus the original YouTube link (for the
  Mac, not the phone).

Channel-level: title "Carry", `<itunes:block>yes`, `<itunes:explicit>false`,
and a fixed cover image so the show looks like a show.

### Hosting

**Recommended: Cloudflare R2.** Free tier is 10 GB storage and, crucially, no
egress charges, so pulling a gigabyte of video to the phone costs nothing.
Public access via the bucket's `r2.dev` URL or a custom subdomain. The Mac
syncs with `rclone` using R2's S3-compatible API.

Privacy comes from the path, not from auth: everything lives under
`/<random-32-char-token>/`, and the only place that token ever appears is the
feed URL pasted into Apple Podcasts. That is how private podcast feeds work
everywhere (Patreon, Supercast, etc.). It is not secret from Cloudflare; it is
secret from the world.

Alternatives, if R2 is unwanted:

- **Backblaze B2**: same shape, 10 GB free, egress free via Cloudflare only.
- **Tailscale + the Mac serving files**: fully private, no cloud at all.
  The phone runs Tailscale, the Mac runs Caddy or `python -m http.server` on
  `~/Carry`, and the feed URL is the Mac's tailnet name. Cost: the Mac must be
  awake whenever the phone refreshes or downloads. Good if the Mac is a desktop
  that never sleeps; wrong if it is a laptop.
- **Not GitHub**: Pages and Releases are public, and a public bucket of
  downloaded YouTube videos is redistribution. Keep it private.

### Retention

The bucket is capped, not infinite. `carry prune` removes the oldest episodes
once the library passes 8 GB or an episode passes 45 days, rebuilds the feed,
and syncs. Apple Podcasts keeps its already-downloaded copy of a removed
episode until it is played or deleted there, so pruning the server never yanks
something mid-listen. Both numbers are config.

### Ways in (triggers)

1. **Claude Code on the Mac** — the primary path.
   `/carry https://youtu.be/… https://youtu.be/…` runs the skill: download,
   notes, publish, and a one-line report per video (title, duration, size).
   Playlists work because yt-dlp expands them; the skill asks before pulling
   more than five.

2. **From the phone, via a Shortcut** — Phase 2.
   A share-sheet Shortcut "Carry this" appends the URL to
   `iCloud Drive/Carry/inbox.txt`. A `launchd` job on the Mac watches that
   file (`WatchPaths`) and runs `carry drain`, which takes every URL in the
   inbox and processes it. The phone shares a link from Messages, Slack, or
   Safari-with-YouTube-blocked without ever opening YouTube. Runs unattended,
   so notes come from `claude -p` or are skipped.

3. **From a Claude cloud session or the Claude app** — Phase 2, optional.
   Cloud cannot download (the 403 above), but it can append to
   `carry/inbox.txt` in this repo and push. The same `launchd` job on the Mac
   also `git pull`s every ten minutes and drains that file. This gives one
   queue any Claude surface can write to.

### Repo layout (proposed)

```
carry/
  DESIGN.md                      this document
  README.md                      setup: brew installs, rclone config, Podcasts subscribe
  bin/carry                      bash: add | drain | build | publish | prune | list
  bin/build-feed.py              library.json -> feed.xml (stdlib only)
  config.example.sh              BUCKET, TOKEN, QUALITY, MAX_GB, MAX_DAYS
  launchd/com.paigetech.carry.plist
  shortcut/Carry-this.shortcut   the share-sheet Shortcut, exported
  cover.jpg                      show artwork
.claude/skills/carry/SKILL.md    the Claude Code skill; wraps bin/carry and writes notes
```

Local state on the Mac, gitignored: `~/Carry/{episodes,library.json,feed.xml,config.sh}`.
The bucket credentials live in `config.sh` on the Mac only.

## Plan

**Phase 0 — prove the pieces (about an hour).**
Install `yt-dlp` and `ffmpeg`, download one video with the command above into
`iCloud Drive/Carry/`, and open it in Files on the phone. Separately, hand-write
a two-item `feed.xml`, put it and one mp4 in R2, and *Follow a Show by URL* in
Apple Podcasts. Done when: the episode plays on the phone, and the audio keeps
going after locking the screen. That last check is the one assumption in this
design worth confirming with a real phone before building on it.

**Phase 1 — the skill (half a day).**
`bin/carry` with `add`, `build`, `publish`, `prune`; `build-feed.py`; the
`SKILL.md` that runs them and writes notes from the transcript. Done when:
`/carry <url>` in Claude Code ends with the episode, with a summary in its
description, downloadable in Apple Podcasts within a few minutes.

**Phase 2 — hands-off intake (a couple of hours).**
The Shortcut, the `launchd` plist, `carry drain`, and the headless notes call.
Done when: sharing a link from Messages on the phone produces an episode with
no further touch on either device.

**Phase 3 — only if needed.**
Audio-only second feed for Overcast; a Tailscale variant of hosting; a custom
app. None of these are planned. The custom app in particular is only
worthwhile if Apple Podcasts fails a hard requirement in Phase 0.

## Decisions for Paige

1. **Hosting**: R2 (recommended), B2, or Tailscale-to-Mac? The answer mostly
   depends on whether the Mac is a desktop that is always on.
2. **Default quality**: 720p video (recommended) or 480p to save cellular and
   bucket space? Audio-only as well, or not?
3. **Retention**: 8 GB / 45 days as defaults, or different?
4. **Phase 2 intake**: Shortcut-to-iCloud, git inbox, both, or neither yet?

## Caveats

- Downloading from YouTube is against its Terms of Service, and Google does
  periodically break yt-dlp. This is personal, private use with a small
  retention window and a private bucket; it is not distribution. Keep it that
  way.
- yt-dlp needs updating when it breaks. Budget for `brew upgrade yt-dlp` being
  the first fix for any failure.
- Apple Podcasts refreshes URL-followed shows on its own schedule, typically
  within an hour; pull-to-refresh forces it. Auto-download only fires on Wi-Fi
  by default, which is probably what a gigabyte of video wants anyway.
- Videos that are age-gated, members-only, or region-locked need cookies passed
  to yt-dlp and are out of scope for v1.
