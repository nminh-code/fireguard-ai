# Camera 01 inference sampling

The production server still starts one FramePipeline using AI_RTSP_URL.
Camera 02 and the unused multi-camera scheduler are not enabled.

AI_TARGET_FPS defaults to 5: a maximum inference start rate, not a promise
of five completed detections per second. AI_FRAME_FPS remains 1 by default.
FFmpeg samples at min(AI_FRAME_FPS, AI_TARGET_FPS) before scaling/IPC.
The queue also spaces inference starts by at least 1000 / AI_TARGET_FPS ms
using a monotonic clock, so buffered input cannot cause catch-up bursts.
There is one active inference and at most one replaceable pending frame.
Evidence receives the same frame object that was submitted for inference.

The existing live/HLS processes are separate and unchanged. Sampling does
not change their FPS, nor eliminate the cost of decoding the AI RTSP stream.

Observed before this change: the live status API reported fpsLimit=1.
Raising AI_FRAME_FPS to 5 would increase, not decrease, this machine's AI
workload. Keep it at 1 for the current optimization. To explicitly request
up to five sampled frames per second later, set both values to 5.

Restart only the AI service to load code/configuration changes, then explicitly
start Camera 01 as usual. This clears in-memory alerts as before. No automatic
restart is performed by this change. Check /v1/pipeline/status for fpsLimit,
processor.targetFps, processedFrames, droppedFrames and pendingFrames.
Measure completed FPS from the processedFrames delta over elapsed seconds.
