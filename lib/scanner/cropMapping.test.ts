import {
  enforceAspectRatioCrop,
  mapGuideFrameToVideoCrop,
  type DomRectLike,
  type VideoCropRect,
} from "@/lib/scanner/cropMapping";

function assertClose(actual: number, expected: number, label: string) {
  if (Math.abs(actual - expected) > 0.5) {
    throw new Error(`${label}: expected ${expected}, got ${actual}`);
  }
}

function testCoverCropCenteredGuideFrame() {
  const videoWidth = 4000;
  const videoHeight = 3000;
  const videoDisplayRect: DomRectLike = { left: 0, top: 0, width: 390, height: 844 };
  const displayedScale = Math.max(
    videoDisplayRect.width / videoWidth,
    videoDisplayRect.height / videoHeight,
  );
  const renderedWidth = videoWidth * displayedScale;
  const renderedHeight = videoHeight * displayedScale;
  const cropX = (renderedWidth - videoDisplayRect.width) / 2;
  const cropY = (renderedHeight - videoDisplayRect.height) / 2;

  const guideWidth = 200;
  const guideHeight = 280;
  const guideFrameRect: DomRectLike = {
    left: (videoDisplayRect.width - guideWidth) / 2,
    top: 200,
    width: guideWidth,
    height: guideHeight,
  };

  const crop = mapGuideFrameToVideoCrop({
    guideFrameRect,
    videoDisplayRect,
    videoWidth,
    videoHeight,
  });

  if (!crop) throw new Error("expected crop");

  assertClose(crop.sw, guideWidth / displayedScale, "crop width");
  assertClose(crop.sh, guideHeight / displayedScale, "crop height");
  assertClose(
    crop.sx,
    (guideFrameRect.left + cropX) / displayedScale,
    "crop x",
  );
  assertClose(
    crop.sy,
    (guideFrameRect.top + cropY) / displayedScale,
    "crop y",
  );
}

function testZeroVideoDimensionsReturnsNull() {
  const crop = mapGuideFrameToVideoCrop({
    guideFrameRect: { left: 0, top: 0, width: 100, height: 140 },
    videoDisplayRect: { left: 0, top: 0, width: 390, height: 844 },
    videoWidth: 0,
    videoHeight: 1080,
  });
  if (crop !== null) throw new Error("expected null crop for zero video width");
}

function testEnforceAspectRatioCrop() {
  const adjusted = enforceAspectRatioCrop(
    { sx: 100, sy: 100, sw: 200, sh: 200 },
    5 / 7,
    4000,
    3000,
  );
  const aspect = adjusted.sw / adjusted.sh;
  if (Math.abs(aspect - 5 / 7) > 0.01) {
    throw new Error(`expected 5:7 aspect, got ${aspect}`);
  }
}

export function runCropMappingTests() {
  testCoverCropCenteredGuideFrame();
  testZeroVideoDimensionsReturnsNull();
  testEnforceAspectRatioCrop();
}

if (process.env.NODE_ENV === "test") {
  runCropMappingTests();
}
