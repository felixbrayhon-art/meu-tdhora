import React, { useEffect, useRef, useState } from 'react';

interface TransparentVideoProps {
  src: string;
  className?: string;
  /** Fraction (0-1) of the canvas the video frame is drawn into, centered,
   * to add breathing room when the source clip is framed edge-to-edge. */
  inset?: number;
  /** width / height of the source video, used to size the canvas correctly
   * from the very first paint so it never flashes at the browser's default
   * 300x150 (landscape) box before the video's real dimensions are known. */
  aspectRatio?: number;
}

// Higgsfield's video output has no alpha channel (MP4 can't carry one) and
// its AI background remover produced unusable noisy mattes for this clip, so
// we key out the near-white backdrop ourselves: draw each frame to a canvas
// and zero the alpha of bright pixels, with a soft ramp near the threshold
// so the character's edge doesn't get a hard cutout line.
const TransparentVideo: React.FC<TransparentVideoProps> = ({ src, className, inset = 1, aspectRatio = 9 / 16 }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setReady(false);
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return;

    const MAX_HEIGHT = 480;
    // Size the canvas to the expected aspect ratio immediately, so it never
    // shows the default 300x150 box while the video is still loading.
    canvas.width = Math.round(MAX_HEIGHT * aspectRatio);
    canvas.height = MAX_HEIGHT;

    let rafId = 0;

    const draw = () => {
      if (video.videoWidth && video.videoHeight) {
        const targetH = Math.min(MAX_HEIGHT, video.videoHeight);
        const targetW = Math.round((targetH / video.videoHeight) * video.videoWidth);
        if (canvas.width !== targetW || canvas.height !== targetH) {
          canvas.width = targetW;
          canvas.height = targetH;
        }
        const drawW = canvas.width * inset;
        const drawH = canvas.height * inset;
        ctx.drawImage(video, (canvas.width - drawW) / 2, (canvas.height - drawH) / 2, drawW, drawH);
        const frame = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const data = frame.data;
        for (let i = 0; i < data.length; i += 4) {
          const brightness = (data[i] + data[i + 1] + data[i + 2]) / 3;
          if (brightness > 232) {
            data[i + 3] = 0;
          } else if (brightness > 195) {
            data[i + 3] = Math.round(255 * (232 - brightness) / 37);
          }
        }
        ctx.putImageData(frame, 0, 0);
        setReady(true);
      }
      rafId = requestAnimationFrame(draw);
    };
    rafId = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(rafId);
  }, [src, inset, aspectRatio]);

  return (
    <>
      <video
        ref={videoRef}
        src={src}
        autoPlay
        loop
        muted
        playsInline
        style={{ position: 'absolute', width: 1, height: 1, opacity: 0, pointerEvents: 'none' }}
      />
      <canvas ref={canvasRef} className={className} style={{ opacity: ready ? 1 : 0, transition: 'opacity 150ms' }} />
    </>
  );
};

export default TransparentVideo;
