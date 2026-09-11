import { describe, expect, it } from "vitest";

import {
  IMAGE_MAX_DISPLAY_WIDTH,
  IMAGE_MIN_DISPLAY_WIDTH,
  clampDisplayWidth,
  imageUrlForKey,
  isAcceptedImageType,
  isValidImageKey,
  newImageKey,
  readImageAlignment,
  readImageWidth,
  stripImageAlignment,
  stripImageWidth,
  writeImageAlignment,
  writeImageWidth,
} from "@/lib/images";
import { readBodyWithinLimit } from "@/lib/requestBody";
import { imageFilesFrom } from "@/components/MarkdownPreview/imageApi";

describe("Markdown image URLs", () => {
  it("round-trips a display width without changing other fragments", () => {
    const source = "/api/images/user/image.webp#section=hero";
    const resized = writeImageWidth(source, 481.6);

    expect(resized).toBe(`${source}&w=482`);
    expect(readImageWidth(resized)).toBe(482);
    expect(stripImageWidth(resized)).toBe(source);
    expect(writeImageWidth(resized, null)).toBe(source);
  });

  it("clamps widths and ignores malformed width fragments", () => {
    expect(clampDisplayWidth(0)).toBe(IMAGE_MIN_DISPLAY_WIDTH);
    expect(clampDisplayWidth(Number.POSITIVE_INFINITY)).toBe(IMAGE_MIN_DISPLAY_WIDTH);
    expect(clampDisplayWidth(IMAGE_MAX_DISPLAY_WIDTH + 1)).toBe(
      IMAGE_MAX_DISPLAY_WIDTH,
    );
    expect(readImageWidth("/image.webp#w=nope")).toBeNull();
    expect(readImageWidth("/image.webp#owner=x&w=12")).toBe(IMAGE_MIN_DISPLAY_WIDTH);
  });

  it("round-trips alignment alongside width and preserves unrelated fragments", () => {
    const source = "/image.webp#owner=me&w=320";
    const centered = writeImageAlignment(source, "center");

    expect(centered).toBe(`${source}&align=center`);
    expect(readImageAlignment(centered)).toBe("center");
    expect(stripImageAlignment(centered)).toBe(source);
    expect(writeImageAlignment(centered, "right")).toBe(
      "/image.webp#owner=me&w=320&align=right",
    );
    expect(writeImageAlignment(centered, "left")).toBe(source);
  });

  it("defaults unknown image alignments to left", () => {
    expect(readImageAlignment("/image.webp")).toBe("left");
    expect(readImageAlignment("/image.webp#align=justify")).toBe("left");
  });

  it("mints valid, distinct keys scoped to an encoded user id", () => {
    const first = newImageKey("user/with spaces");
    const second = newImageKey("user/with spaces");

    expect(first).toMatch(/^user%2Fwith%20spaces\/[0-9a-f]{32}\.webp$/);
    expect(isValidImageKey(first)).toBe(true);
    expect(imageUrlForKey(first)).toBe(`/api/images/${first}`);
    expect(second).not.toBe(first);
  });

  it("rejects keys that could escape or probe the bucket", () => {
    expect(isValidImageKey("user/not-hex.webp")).toBe(false);
    expect(isValidImageKey("user/0123456789abcdef0123456789abcdef.png")).toBe(false);
    expect(isValidImageKey("../0123456789abcdef0123456789abcdef.webp")).toBe(false);
    expect(isValidImageKey("user/nested/0123456789abcdef0123456789abcdef.webp")).toBe(false);
  });

  it("accepts only the image formats transformed by the upload route", () => {
    expect(isAcceptedImageType("image/jpeg")).toBe(true);
    expect(isAcceptedImageType("IMAGE/WEBP")).toBe(true);
    expect(isAcceptedImageType("image/svg+xml")).toBe(false);
    expect(isAcceptedImageType("text/html")).toBe(false);
  });
});

describe("readBodyWithinLimit", () => {
  it("reads a body at the exact byte limit", async () => {
    const result = await readBodyWithinLimit(
      new Request("https://klipcode.test/upload", {
        method: "POST",
        body: new Uint8Array([1, 2, 3]),
      }),
      3,
    );

    expect(result).toEqual({ tooLarge: false, bytes: new Uint8Array([1, 2, 3]) });
  });

  it("rejects an oversized declared body without reading its stream", async () => {
    let readerRequested = false;
    const request = {
      headers: new Headers({ "content-length": "10" }),
      body: {
        getReader() {
          readerRequested = true;
          throw new Error("the body should not be read");
        },
      },
    } as unknown as Request;

    expect(await readBodyWithinLimit(request, 3)).toEqual({ tooLarge: true });
    expect(readerRequested).toBe(false);
  });

  it("stops a streamed body once it crosses the limit", async () => {
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new Uint8Array([1, 2]));
        controller.enqueue(new Uint8Array([3, 4]));
        controller.close();
      },
    });
    const request = new Request("https://klipcode.test/upload", {
      method: "POST",
      body,
      duplex: "half",
    } as RequestInit & { duplex: "half" });

    expect(await readBodyWithinLimit(request, 3)).toEqual({ tooLarge: true });
  });
});

describe("imageFilesFrom", () => {
  const image = { name: "screenshot.png", type: "image/png" } as File;
  const text = { name: "notes.txt", type: "text/plain" } as File;

  it("takes image files directly from a regular drop or paste", () => {
    const transfer = { files: [text, image], items: [] } as unknown as DataTransfer;

    expect(imageFilesFrom(transfer)).toEqual([image]);
  });

  it("extracts clipboard images exposed only as DataTransfer items", () => {
    const transfer = {
      files: [],
      items: [
        { kind: "string", type: "text/plain", getAsFile: () => null },
        { kind: "file", type: "image/png", getAsFile: () => image },
      ],
    } as unknown as DataTransfer;

    expect(imageFilesFrom(transfer)).toEqual([image]);
  });

  it("ignores empty and non-image clipboard items", () => {
    const transfer = {
      files: [],
      items: [
        { kind: "file", type: "text/plain", getAsFile: () => text },
        { kind: "file", type: "image/png", getAsFile: () => null },
      ],
    } as unknown as DataTransfer;

    expect(imageFilesFrom(transfer)).toEqual([]);
    expect(imageFilesFrom(null)).toEqual([]);
  });
});
