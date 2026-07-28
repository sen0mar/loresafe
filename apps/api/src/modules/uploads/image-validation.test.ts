import sharp from "sharp";
import { describe, expect, it } from "vitest";

import { processUploadedImage } from "./image-validation.js";

describe("uploaded image processing", () => {
  it.each([
    ["image/png", "png"],
    ["image/jpeg", "jpeg"],
    ["image/webp", "webp"]
  ] as const)("rejects truncated %s data", async (contentType, format) => {
    const validImage = await createImage(format);
    const truncatedImage = validImage.subarray(0, validImage.byteLength - 8);

    await expect(
      processUploadedImage(truncatedImage, contentType, "AVATAR")
    ).rejects.toThrow();
  });

  it("decodes and re-encodes polyglot input without trailing payload or metadata", async () => {
    const marker = Buffer.from("LORESAFE-POLYGLOT-MARKER");
    const image = await sharp({
      create: {
        width: 12,
        height: 10,
        channels: 3,
        background: "#123456"
      }
    })
      .withMetadata({
        exif: {
          IFD0: {
            ImageDescription: "private upload metadata"
          }
        }
      })
      .png()
      .toBuffer();
    const polyglot = Buffer.concat([image, marker]);

    const processed = await processUploadedImage(
      polyglot,
      "image/png",
      "AVATAR"
    );
    const metadata = await sharp(processed.bytes).metadata();

    expect(Buffer.from(processed.bytes).includes(marker)).toBe(false);
    expect(metadata.exif).toBeUndefined();
    expect(processed.validation).toMatchObject({
      widthPx: 12,
      heightPx: 10,
      isAnimated: false,
      sizeBytes: processed.bytes.byteLength
    });
  });

  it("rejects structurally incomplete header-only images", async () => {
    const headerOnlyPng = new Uint8Array(128);
    headerOnlyPng.set([137, 80, 78, 71, 13, 10, 26, 10], 0);
    headerOnlyPng.set([73, 72, 68, 82], 12);
    new DataView(headerOnlyPng.buffer).setUint32(16, 64);
    new DataView(headerOnlyPng.buffer).setUint32(20, 64);

    await expect(
      processUploadedImage(headerOnlyPng, "image/png", "AVATAR")
    ).rejects.toThrow();
  });

  it("rejects images beyond dimension and byte limits", async () => {
    const tooWide = await sharp({
      create: {
        width: 4097,
        height: 1,
        channels: 3,
        background: "#000000"
      }
    })
      .png()
      .toBuffer();

    await expect(
      processUploadedImage(tooWide, "image/png", "AVATAR")
    ).rejects.toThrow("Image dimensions exceed the allowed limits.");

    const tooManyPixels = await sharp({
      create: {
        width: 4000,
        height: 4001,
        channels: 3,
        background: "#000000"
      }
    })
      .png()
      .toBuffer();

    await expect(
      processUploadedImage(tooManyPixels, "image/png", "AVATAR")
    ).rejects.toThrow();

    await expect(
      processUploadedImage(
        new Uint8Array(2 * 1024 * 1024 + 1),
        "image/png",
        "AVATAR"
      )
    ).rejects.toThrow("Image exceeds the allowed size.");
  });

  it("rejects content that does not match its declared image type", async () => {
    const jpeg = await createImage("jpeg");

    await expect(
      processUploadedImage(jpeg, "image/png", "AVATAR")
    ).rejects.toThrow();
  });
});

const createImage = (format: "jpeg" | "png" | "webp") => {
  const image = sharp({
    create: {
      width: 8,
      height: 8,
      channels: 3,
      background: "#123456"
    }
  });

  switch (format) {
    case "jpeg":
      return image.jpeg().toBuffer();
    case "png":
      return image.png().toBuffer();
    case "webp":
      return image.webp().toBuffer();
  }
};
