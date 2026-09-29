---
name: carry
description: Download one or more YouTube URLs onto the iPhone via iCloud Drive, so they appear in the Files app without the phone touching YouTube. Use whenever Paige sends YouTube links to "carry", "send to my phone", "download for the phone", or invokes /carry. Runs on the Mac only; YouTube blocks downloads from cloud sessions.
---

# Carry

Get YouTube videos onto the phone as plain files in iCloud Drive › Carry.
Version zero: no server, no feed, no app on the phone.

## Steps

1. **Collect the URLs** from the message. Accept `youtube.com/watch`,
   `youtu.be`, `youtube.com/shorts`, and `youtube.com/live` links, one or
   many, in any formatting (lines, commas, prose). Ignore everything else and
   say what was ignored. If there are no URLs, ask for them and stop.

2. **Run the script** from this skill's directory, all URLs in one call:

   ```
   bin/carry URL [URL...]
   ```

   Quality defaults to 1080p (H.264/AAC mp4, the format the iPhone's own
   player handles). Override with `CARRY_HEIGHT=720 bin/carry ...` only if
   asked. A playlist URL downloads just the one video, not the playlist,
   unless Paige asks for the whole playlist, in which case add `--playlist`
   after a `--dry-run --playlist` to see how many videos that is.

3. **Report** one line per video: title, duration, size, and the filename
   the script printed. Then say the files will appear in the Files app under
   iCloud Drive › Carry once iCloud finishes syncing (a gigabyte can take a
   few minutes on Wi-Fi). Files are already in the folder on the Mac when the
   script exits; the wait is only iCloud's.

## When it fails

- `yt-dlp not installed` or `ffmpeg not installed`: run
  `brew install yt-dlp ffmpeg` and retry.
- `Sign in to confirm you're not a bot`, `403 Forbidden`, or format errors on
  a video that plainly exists: YouTube has moved and yt-dlp needs an update.
  Run `brew upgrade yt-dlp` and retry once. If it still fails, report it and
  stop; do not try cookies or other workarounds without asking.
- `already in Carry, skipping`: it was downloaded before. The archive is
  `~/.carry/done.txt`; delete the matching line to force a re-download.
- One URL failing must not stop the others. The script continues; report
  each outcome.

## Do not

- Do not run this from a cloud session. It will fail on the download step.
- Do not re-encode, change the container, or pick VP9/AV1 to get higher
  quality. The script's format chain is deliberate.
- Do not put anything into the Carry folder other than the script's output.
