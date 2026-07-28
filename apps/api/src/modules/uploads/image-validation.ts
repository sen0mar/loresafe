import sharp, { type Sharp } from "sharp";

import type { FileAssetPurpose } from "./uploads.repository.js";

export type ValidatedImage = {
  widthPx: number;
  heightPx: number;
  isAnimated: boolean;
  sizeBytes?: number;
};

export type ProcessedImage = {
  bytes: Uint8Array;
  validation: ValidatedImage;
};

const imageLimits: Record<
  FileAssetPurpose,
  {
    maxWidth: number;
    maxHeight: number;
    maxPixels: number;
    maxSizeBytes: number;
  }
> = {
  AVATAR: {
    maxWidth: 4096,
    maxHeight: 4096,
    maxPixels: 16_000_000,
    maxSizeBytes: 2 * 1024 * 1024
  },
  CLUB_COVER: {
    maxWidth: 8192,
    maxHeight: 8192,
    maxPixels: 40_000_000,
    maxSizeBytes: 5 * 1024 * 1024
  },
  POST_IMAGE: {
    maxWidth: 8192,
    maxHeight: 8192,
    maxPixels: 40_000_000,
    maxSizeBytes: 8 * 1024 * 1024
  }
};

const formatByContentType = {
  "image/jpeg": "jpeg",
  "image/png": "png",
  "image/webp": "webp"
} as const;

type SupportedContentType = keyof typeof formatByContentType;
type SupportedFormat = (typeof formatByContentType)[SupportedContentType];

export const processUploadedImage = async (
  bytes: Uint8Array,
  contentType: string,
  purpose: FileAssetPurpose
): Promise<ProcessedImage> => {
  const normalizedContentType = contentType.toLowerCase();

  if (!(normalizedContentType in formatByContentType)) {
    throw new Error("Unsupported image type.");
  }

  const limits = imageLimits[purpose];

  if (bytes.byteLength > limits.maxSizeBytes) {
    throw new Error("Image exceeds the allowed size.");
  }

  const expectedFormat =
    formatByContentType[normalizedContentType as SupportedContentType];
  assertCompleteContainer(bytes, expectedFormat);
  const input = sharp(toBuffer(bytes), {
    animated: true,
    failOn: "error",
    limitInputPixels: limits.maxPixels,
    sequentialRead: true,
    unlimited: false
  });
  const metadata = await input.metadata();

  if (metadata.format !== expectedFormat) {
    throw new Error("Image content does not match its declared type.");
  }

  if ((metadata.pages ?? 1) !== 1) {
    throw new Error("Animated images are not supported.");
  }

  validateDimensions(metadata.width, metadata.height, limits);

  const output = await encodeImage(input.autoOrient(), expectedFormat);
  const outputMetadata = await sharp(output.data, {
    limitInputPixels: limits.maxPixels,
    unlimited: false
  }).metadata();
  const widthPx = outputMetadata.width;
  const heightPx = outputMetadata.height;

  validateDimensions(widthPx, heightPx, limits);

  if (output.data.byteLength > limits.maxSizeBytes) {
    throw new Error("Processed image exceeds the allowed size.");
  }

  return {
    bytes: output.data,
    validation: {
      widthPx: widthPx ?? 0,
      heightPx: heightPx ?? 0,
      isAnimated: false,
      sizeBytes: output.data.byteLength
    }
  };
};

const encodeImage = (
  image: Sharp,
  format: SupportedFormat
): Promise<{ data: Buffer }> => {
  switch (format) {
    case "jpeg":
      return image
        .jpeg({ chromaSubsampling: "4:2:0", progressive: false, quality: 85 })
        .toBuffer({ resolveWithObject: true });
    case "png":
      return image
        .png({ adaptiveFiltering: true, compressionLevel: 9 })
        .toBuffer({ resolveWithObject: true });
    case "webp":
      return image
        .webp({ effort: 4, lossless: false, quality: 85 })
        .toBuffer({ resolveWithObject: true });
  }
};

const validateDimensions = (
  width: number | undefined,
  height: number | undefined,
  limits: (typeof imageLimits)[FileAssetPurpose]
) => {
  if (!width || !height) {
    throw new Error("Image dimensions are invalid.");
  }

  if (
    width > limits.maxWidth ||
    height > limits.maxHeight ||
    width * height > limits.maxPixels
  ) {
    throw new Error("Image dimensions exceed the allowed limits.");
  }
};

const toBuffer = (bytes: Uint8Array) =>
  Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength);

const assertCompleteContainer = (
  bytes: Uint8Array,
  format: SupportedFormat
) => {
  if (format === "png") {
    const iendChunk = Uint8Array.from([
      0, 0, 0, 0, 73, 69, 78, 68, 174, 66, 96, 130
    ]);

    if (!containsBytes(bytes, iendChunk)) {
      throw new Error("PNG image stream is incomplete.");
    }

    return;
  }

  if (format === "jpeg") {
    if (!containsBytes(bytes, Uint8Array.from([0xff, 0xd9]))) {
      throw new Error("JPEG image stream is incomplete.");
    }

    return;
  }

  if (bytes.byteLength < 12) {
    throw new Error("WebP image stream is incomplete.");
  }

  const declaredSize =
    (bytes[4] ?? 0) +
    (bytes[5] ?? 0) * 0x100 +
    (bytes[6] ?? 0) * 0x10000 +
    (bytes[7] ?? 0) * 0x1000000 +
    8;

  if (declaredSize > bytes.byteLength) {
    throw new Error("WebP image stream is incomplete.");
  }
};

const containsBytes = (bytes: Uint8Array, expected: Uint8Array) =>
  bytes.some((_, index) =>
    expected.every(
      (expectedByte, expectedIndex) =>
        bytes[index + expectedIndex] === expectedByte
    )
  );
