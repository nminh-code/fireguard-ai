# Local RTSP bridge

Run from the project root: `npm run bridge`.

The bridge uses RTSP **UDP only**, the configured URL (default `/onvif2`),
and a 4 MiB receive buffer. The default FFmpeg executable is the installed
`D:\ffmpeg-9.0.1-essentials_build\bin\ffmpeg.exe`; the alternate requested layout
`D:\ffmpeg-9.0.1-essentials\_build\bin\ffmpeg.exe` is preferred if present.
`FFMPEG_PATH` still overrides both paths. Credentials come only from the request;
raw FFmpeg stderr, command arguments and URL errors are never logged or returned.

Each camera test creates a UUID stream directory and retains the existing API.
Within that playback session, FFmpeg exit or 10 seconds without a fresh completed
HLS segment triggers recovery. Polling is every 500 ms. Recovery waits for the
old process's `close` event (SIGTERM, then SIGKILL after 3 seconds, with a further
3-second deadline). If closure cannot be confirmed, no replacement is started.
Retries wait 2 seconds and are capped at **5 total reconnects per playback
session**; successful recovery does not reset that cap. A new Camera Test starts
a new budget. The initial test request still has a 25-second readiness deadline.

Recovery starts a fresh FFmpeg process, removes incomplete `.tmp` output, and
preserves published HLS files. `append_list` keeps sequence numbers advancing and
adds a discontinuity for the new encoder timeline. `temp_file` keeps segment and
playlist publication atomic. The playback URL and session directory stay the
same. Valid existing playlists remain available for up to 20 seconds after their
last segment during recovery; unavailable/stale playlists return retryable 503.
Stopped/exhausted sessions return 410. Status is CONNECTING until the running
attempt has published new media and its playlist references at least three
nonempty segments; stopped/exhausted sessions are NOT_CONNECTED.

Run regression tests: `node --test video-bridge/session.test.mjs`.
Tests cover process lifecycle, segment stalls, retry bounds, disconnect,
unresponsive termination, readiness, and real FFmpeg HLS restart continuity.
The real FFmpeg test uses a synthetic source; camera packet loss still needs
validation on the actual Yoosee network. A larger buffer/restart cannot repair
HEVC reference frames that were already lost upstream.
