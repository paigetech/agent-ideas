# Carry

YouTube videos onto an iPhone that has no YouTube. Version zero: a script and a
Claude Code skill on the Mac download videos into iCloud Drive, and they show
up in the Files app on the phone. See [DESIGN.md](DESIGN.md) for where this
could go later; none of that is built.

## Setup, once

```
brew install yt-dlp ffmpeg
git clone https://github.com/paigetech/agent-ideas.git ~/agent-ideas
mkdir -p ~/.claude/skills
ln -s ~/agent-ideas/carry ~/.claude/skills/carry
```

That symlink makes `/carry` available in every Claude Code session on the Mac,
not only inside this repo. On the phone, open Files › iCloud Drive; the Carry
folder appears after the first download.

## Use

In Claude Code on the Mac:

```
/carry https://youtu.be/abc123 https://www.youtube.com/watch?v=def456
```

or paste a list of links and say "carry these". Claude runs the script, reports
title, duration, and size per video, and the files sync to the phone.

Without Claude:

```
~/agent-ideas/carry/bin/carry URL [URL...]
~/agent-ideas/carry/bin/carry --dry-run URL      # what would it fetch
pbpaste | ~/agent-ideas/carry/bin/carry -        # URLs from the clipboard
```

## What it does

- Downloads the best H.264 video up to 1080p plus AAC audio, merged into an
  mp4. That is the combination the Files app plays without complaint;
  YouTube's own "best" is usually VP9 or AV1, which it does not.
- Downloads into `~/.carry/staging` and moves the finished file into iCloud in
  one step, so iCloud never syncs a half-written video.
- Remembers what it has fetched in `~/.carry/done.txt` and skips repeats.
- Names files `Title [videoid].mp4`.

Settings are environment variables, all optional:

| variable | default | meaning |
|---|---|---|
| `CARRY_HEIGHT` | `1080` | maximum video height |
| `CARRY_DIR` | `iCloud Drive/Carry` | where finished files go |
| `CARRY_STAGING` | `~/.carry/staging` | where downloads happen first |

## Limits of version zero

- The Files app player has no speed control, no position memory, and stops
  when the screen locks. VLC or Infuse on the phone can open the same files
  from iCloud Drive and fix all three; that is a one-app install, no changes
  here.
- Nothing prunes the folder. Delete watched videos from Files on the phone
  and they leave iCloud everywhere. 1080p runs roughly 1–2 GB per hour.
- It must run on the Mac. YouTube refuses the media download from cloud IPs.
- When YouTube changes something, `brew upgrade yt-dlp` is the first fix.
