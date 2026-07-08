import { mapDisplayRectToVideoCrop } from "@/lib/scanner/videoCoordinates";

export type VideoCropRect = {
  sx: number;
  sy: number;
  sw: number;
  sh: number;
};

export type DomRectLike = {
  left: number;
  top: number;
  width: number;
  height: number;
};

export function computeGuideFrameSize(
  usableWidth: number,
  usableHeight: number,
  targetAspect: number,
  fill = 0.92,
) {
  if (usableWidth <= 0 || usableHeight <= 0 || targetAspect <= 0) {
    return { width: 0, height: 0 };
  }

  const maxWidth = usableWidth * fill;
  const maxHeight = usableHeight * fill;

  if (maxWidth / maxHeight > targetAspect) {
    const height = maxHeight;
    return { width: height * targetAspect, height };
  }

  const width = maxWidth;
  return { width, height: width / targetAspect };
}

export function mapGuideFrameToVideoCrop(options: {
  guideFrameRect: DomRectLike;
  videoDisplayRect: DomRectLike;
  videoWidth: number;
  videoHeight: number;
}): VideoCropRect | null {
  const { guideFrameRect, videoDisplayRect, videoWidth, videoHeight } = options;

  if (!videoWidth || !videoHeight || !videoDisplayRect.width || !videoDisplayRect.height) {
    return null;
  }

  const localX = guideFrameRect.left - videoDisplayRect.left;
  const localY = guideFrameRect.top - videoDisplayRect.top;

  return clampCrop(
    mapDisplayRectToVideoCrop(
      localX,
      localY,
      guideFrameRect.width,
      guideFrameRect.height,
      {
        videoWidth,
        videoHeight,
        displayWidth: videoDisplayRect.width,
        displayHeight: videoDisplayRect.height,
      },
    ),
    videoWidth,
    videoHeight,
  );
}

export function clampCrop(
  crop: VideoCropRect,
  videoWidth: number,
  videoHeight: number,
): VideoCropRect {
  let { sx, sy, sw, sh } = crop;

  sw = Math.max(1, Math.min(sw, videoWidth));
  sh = Math.max(1, Math.min(sh, videoHeight));
  sx = Math.max(0, Math.min(sx, videoWidth - sw));
  sy = Math.max(0, Math.min(sy, videoHeight - sh));

  return { sx, sy, sw, sh };
}

export function enforceAspectRatioCrop(
  crop: VideoCropRect,
  targetAspect: number,
  videoWidth: number,
  videoHeight: number,
): VideoCropRect {
  if (!targetAspect || !videoWidth || !videoHeight) return crop;

  let { sx, sy, sw, sh } = crop;
  if (sw <= 0 || sh <= 0) return clampCrop(crop, videoWidth, videoHeight);

  const currentAspect = sw / sh;
  if (Math.abs(currentAspect - targetAspect) < 0.001) {
    return clampCrop(crop, videoWidth, videoHeight);
  }

  const centerX = sx + sw / 2;
  const centerY = sy + sh / 2;

  if (currentAspect > targetAspect) {
    sw = sh * targetAspect;
  } else {
    sh = sw / targetAspect;
  }

  sx = centerX - sw / 2;
  sy = centerY - sh / 2;

  return clampCrop({ sx, sy, sw, sh }, videoWidth, videoHeight);
}

export function domRectLike(rect: DOMRect | DOMRectReadOnly): DomRectLike {
  return {
    left: rect.left,
    top: rect.top,
    width: rect.width,
    height: rect.height,
  };
}
