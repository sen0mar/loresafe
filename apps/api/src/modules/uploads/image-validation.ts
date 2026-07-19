import type { FileAssetPurpose } from "./uploads.repository.js";

export type ValidatedImage = {
  widthPx: number;
  heightPx: number;
  isAnimated: boolean;
};

const imageLimits: Record<
  FileAssetPurpose,
  { maxWidth: number; maxHeight: number; maxPixels: number }
> = {
  AVATAR: {
    maxWidth: 4096,
    maxHeight: 4096,
    maxPixels: 16_000_000
  },
  CLUB_COVER: {
    maxWidth: 8192,
    maxHeight: 8192,
    maxPixels: 40_000_000
  },
  POST_IMAGE: {
    maxWidth: 8192,
    maxHeight: 8192,
    maxPixels: 40_000_000
  }
};

export const validateUploadedImage = (
  bytes: Uint8Array,
  contentType: string,
  purpose: FileAssetPurpose
): ValidatedImage => {
  const image = parseImage(bytes, contentType);
  const limits = imageLimits[purpose];

  if (
    image.widthPx > limits.maxWidth ||
    image.heightPx > limits.maxHeight ||
    image.widthPx * image.heightPx > limits.maxPixels
  ) {
    throw new Error("Image dimensions exceed the allowed limits.");
  }

  // Animated files are rejected until the product has a safe processing policy for them.
  if (image.isAnimated) {
    throw new Error("Animated images are not supported.");
  }

  return image;
};

const parseImage = (bytes: Uint8Array, contentType: string): ValidatedImage => {
  switch (contentType.toLowerCase()) {
    case "image/jpeg":
      return parseJpeg(bytes);
    case "image/png":
      return parsePng(bytes);
    case "image/webp":
      return parseWebp(bytes);
    default:
      throw new Error("Unsupported image type.");
  }
};

const parsePng = (bytes: Uint8Array): ValidatedImage => {
  const signature = [137, 80, 78, 71, 13, 10, 26, 10];

  if (
    bytes.length < 24 ||
    !signature.every((value, index) => bytes[index] === value) ||
    readAscii(bytes, 12, 4) !== "IHDR"
  ) {
    throw new Error("The object is not a valid PNG image.");
  }

  return validDimensions({
    widthPx: readUint32Be(bytes, 16),
    heightPx: readUint32Be(bytes, 20),
    isAnimated: containsAscii(bytes, "acTL")
  });
};

const parseJpeg = (bytes: Uint8Array): ValidatedImage => {
  if (bytes.length < 12 || bytes[0] !== 0xff || bytes[1] !== 0xd8) {
    throw new Error("The object is not a valid JPEG image.");
  }

  let offset = 2;

  while (offset + 8 < bytes.length) {
    if (bytes[offset] !== 0xff) {
      offset += 1;
      continue;
    }

    while (bytes[offset] === 0xff) {
      offset += 1;
    }

    const marker = bytes[offset];
    offset += 1;

    if (marker === undefined || marker === 0xd8 || marker === 0xd9) {
      continue;
    }

    if (marker >= 0xd0 && marker <= 0xd7) {
      continue;
    }

    const segmentLength = readUint16Be(bytes, offset);

    if (segmentLength < 2 || offset + segmentLength > bytes.length) {
      break;
    }

    if (isJpegStartOfFrame(marker) && segmentLength >= 7) {
      return validDimensions({
        widthPx: readUint16Be(bytes, offset + 5),
        heightPx: readUint16Be(bytes, offset + 3),
        isAnimated: false
      });
    }

    offset += segmentLength;
  }

  throw new Error("JPEG dimensions could not be verified.");
};

const parseWebp = (bytes: Uint8Array): ValidatedImage => {
  if (
    bytes.length < 30 ||
    readAscii(bytes, 0, 4) !== "RIFF" ||
    readAscii(bytes, 8, 4) !== "WEBP"
  ) {
    throw new Error("The object is not a valid WebP image.");
  }

  const chunkType = readAscii(bytes, 12, 4);
  const isAnimated = containsAscii(bytes, "ANIM");

  if (chunkType === "VP8X") {
    return validDimensions({
      widthPx: 1 + readUint24Le(bytes, 24),
      heightPx: 1 + readUint24Le(bytes, 27),
      isAnimated: isAnimated || ((bytes[20] ?? 0) & 0x02) !== 0
    });
  }

  if (chunkType === "VP8L" && bytes[20] === 0x2f) {
    const first = bytes[21] ?? 0;
    const second = bytes[22] ?? 0;
    const third = bytes[23] ?? 0;
    const fourth = bytes[24] ?? 0;

    return validDimensions({
      widthPx: 1 + first + ((second & 0x3f) << 8),
      heightPx:
        1 + ((second & 0xc0) >> 6) + (third << 2) + ((fourth & 0x0f) << 10),
      isAnimated
    });
  }

  if (
    chunkType === "VP8 " &&
    bytes[23] === 0x9d &&
    bytes[24] === 0x01 &&
    bytes[25] === 0x2a
  ) {
    return validDimensions({
      widthPx: readUint16Le(bytes, 26) & 0x3fff,
      heightPx: readUint16Le(bytes, 28) & 0x3fff,
      isAnimated
    });
  }

  throw new Error("WebP dimensions could not be verified.");
};

const validDimensions = (image: ValidatedImage) => {
  if (image.widthPx <= 0 || image.heightPx <= 0) {
    throw new Error("Image dimensions are invalid.");
  }

  return image;
};

const isJpegStartOfFrame = (marker: number) =>
  marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker);

const readAscii = (bytes: Uint8Array, offset: number, length: number) =>
  String.fromCharCode(...bytes.slice(offset, offset + length));

const containsAscii = (bytes: Uint8Array, value: string) => {
  const pattern = Uint8Array.from(value, (character) =>
    character.charCodeAt(0)
  );

  return bytes.some((_, index) =>
    pattern.every(
      (character, patternIndex) => bytes[index + patternIndex] === character
    )
  );
};

const readUint16Be = (bytes: Uint8Array, offset: number) =>
  ((bytes[offset] ?? 0) << 8) | (bytes[offset + 1] ?? 0);

const readUint16Le = (bytes: Uint8Array, offset: number) =>
  (bytes[offset] ?? 0) | ((bytes[offset + 1] ?? 0) << 8);

const readUint24Le = (bytes: Uint8Array, offset: number) =>
  (bytes[offset] ?? 0) |
  ((bytes[offset + 1] ?? 0) << 8) |
  ((bytes[offset + 2] ?? 0) << 16);

const readUint32Be = (bytes: Uint8Array, offset: number) =>
  ((bytes[offset] ?? 0) * 0x1000000 +
    ((bytes[offset + 1] ?? 0) << 16) +
    ((bytes[offset + 2] ?? 0) << 8) +
    (bytes[offset + 3] ?? 0)) >>>
  0;
