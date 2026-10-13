# Live video through VLC — 13 October 2026

Implemented `camera RTSP -> hidden VLC software HEVC decode/H.264 encode ->
loopback HTTP MPEG-TS -> FFmpeg stream copy/HLS -> browser`. The local
configuration selects VLC at `D:/VLC/vlc.exe`. The bridge owns and stops the
relay with the camera session; Windows service scripts stop the verified
service process tree so VLC/FFmpeg are not left running. VLC mode explicitly
disables the player's direct WebRTC route. The AI source and running AI session
were retained.

Validation on the real `cam-test` camera:

- Process inspection: VLC alone reads RTSP for live; the live FFmpeg reads
  loopback HTTP and uses video copy. The separate AI FFmpeg still reads its
  configured RTSP source.
- Latest observation: VLC relay RUNNING, HLS CONNECTED for 359 seconds;
  media sequence 324, 4,942 output frames, playlist age about 521 ms. AI remains
  RUNNING in the same session and continues receiving frames.
- Chrome observation for 45 seconds: no HLS HTTP failures, no source switch,
  no seek/jump to live. Two nonfatal `bufferStalledError` events; the longest
  measured waiting interval was about 315 ms. Seven dropped browser frames out
  of 623 total frames. This is an observation, not a controlled causal comparison
  against the earlier direct-input test.
- Five saved HLS segments decode successfully: H.264, 640x720, nominal 15 fps,
  75 frames, maximum frame timestamp gap about 150 ms. The images still include
  severely damaged/grey frames alternating with clear camera images. VLC has
  **not** eliminated upstream corruption or proved the network healthy.
- `npm run test:bridge`: 13 passed, including the real synthetic FFmpeg HLS
  continuity test. `npm run build` and `npm run lint` passed. Edited PowerShell
  scripts pass syntax parsing; the actual start/stop-all scripts were not run
  because they would stop other active services.

Artifacts: `.tmp/vlc-audit/after-browser.json`, `after-browser.png`, and
`after-hls/contact.png`. No physical camera settings, detector thresholds,
model, or player buffer settings were changed. The bridge keeps VLC's 1000 ms
network cache and reconnects its local HTTP input when necessary. Software
decoding is used because the headless hardware path did not remain stable in
the probes. The real network/HEVC corruption remains a separate unresolved
issue; a relay cannot reconstruct packets already lost.
