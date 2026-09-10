// Rear camera into a <video>. Needs a secure context (https or localhost).

export type CameraError = 'insecure-context' | 'unsupported' | 'denied' | 'unavailable'

export async function startRearCamera(video: HTMLVideoElement): Promise<MediaStream | CameraError> {
  if (!window.isSecureContext) return 'insecure-context'
  if (!navigator.mediaDevices?.getUserMedia) return 'unsupported'
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: { ideal: 'environment' }, width: { ideal: 1920 }, height: { ideal: 1080 } },
      audio: false,
    })
    video.srcObject = stream
    // iOS needs these to autoplay inline without a tap on the element itself.
    video.muted = true
    video.playsInline = true
    await video.play()
    return stream
  } catch (e) {
    const name = (e as DOMException)?.name
    if (name === 'NotAllowedError' || name === 'SecurityError') return 'denied'
    return 'unavailable'
  }
}

export function stopStream(stream: MediaStream | null) {
  stream?.getTracks().forEach((t) => t.stop())
}
