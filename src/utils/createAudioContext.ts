/**
 * Creates a cross-browser AudioContext, handling the webkit prefix for older iOS/Safari.
 */
export function createAudioContext(): AudioContext {
  const AudioCtx =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  return new AudioCtx();
}
