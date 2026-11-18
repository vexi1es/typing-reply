/** Output video: portrait 9:16 — the whole phone with the chat header is in the frame. */
export const VIDEO = { width: 720, height: 1280, fps: 30 } as const;
/** Smaller size tried when the device's encoder refuses the main one. */
export const VIDEO_FALLBACK = { width: 540, height: 960, fps: 30 } as const;
