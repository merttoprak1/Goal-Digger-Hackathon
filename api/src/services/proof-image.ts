import Busboy from "busboy";
import { createHash } from "node:crypto";
import type { Request } from "express";
import sharp from "sharp";
import { ApiError } from "../middlewares/error-handler.js";

export const maxProofImageBytes = 5 * 1024 * 1024;
const maxPixels = 40_000_000;
const signatures: Record<string, (bytes: Buffer) => boolean> = {
  "image/jpeg": (bytes) => bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff,
  "image/png": (bytes) => bytes.length >= 8 && bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])),
  "image/webp": (bytes) => bytes.length >= 12 && bytes.toString("ascii", 0, 4) === "RIFF" && bytes.toString("ascii", 8, 12) === "WEBP",
};

export interface ProofImage {
  mimeType: "image/jpeg" | "image/png" | "image/webp";
  bytes: Buffer;
  dataUrl: string;
  hash: string;
}

export async function validateProofImage(bytes: Buffer, mimeType: string): Promise<ProofImage> {
  if (!signatures[mimeType] || !signatures[mimeType]!(bytes)) {
    throw new ApiError(400, "Upload a JPEG, PNG, or WebP image whose contents match its file type.", "INVALID_PROOF_IMAGE");
  }
  if (!bytes.length || bytes.length > maxProofImageBytes) {
    throw new ApiError(413, "The proof image must not exceed 5 MiB.", "PROOF_IMAGE_TOO_LARGE");
  }
  try {
    const decoded = sharp(bytes, { limitInputPixels: maxPixels, failOn: "error" });
    const metadata = await decoded.metadata();
    const expectedFormat = { "image/jpeg": "jpeg", "image/png": "png", "image/webp": "webp" }[mimeType];
    if (!metadata.width || !metadata.height || metadata.width * metadata.height > maxPixels || metadata.format !== expectedFormat) {
      throw new Error("Unsupported image metadata.");
    }
    await decoded.resize(1, 1, { fit: "inside" }).toBuffer();
  } catch {
    throw new ApiError(400, "The proof image is damaged or exceeds 40 megapixels.", "INVALID_PROOF_IMAGE");
  }
  return {
    mimeType: mimeType as ProofImage["mimeType"],
    bytes,
    dataUrl: `data:${mimeType};base64,${bytes.toString("base64")}`,
    hash: createHash("sha256").update(bytes).digest("hex"),
  };
}

export async function parseProofMultipart(request: Request): Promise<{ statement: string; image?: ProofImage }> {
  return new Promise((resolve, reject) => {
    let parser: ReturnType<typeof Busboy>;
    try {
      parser = Busboy({
        headers: request.headers,
        limits: { files: 1, fields: 1, fileSize: maxProofImageBytes, fieldSize: 1000 },
      });
    } catch {
      reject(new ApiError(400, "Send a valid multipart proof form.", "INVALID_PROOF"));
      return;
    }

    let statement = "";
    let hasStatement = false;
    let imageChunks: Buffer[] | null = null;
    let imageMimeType = "";
    let imageBytes: Buffer | null = null;
    let parseError: ApiError | null = null;
    const fail = (error: ApiError) => { parseError ??= error; };

    parser.on("field", (name, value, info) => {
      if (name !== "statement" || hasStatement || info.valueTruncated) {
        fail(new ApiError(400, "Send only one proof statement and one image.", "INVALID_PROOF"));
        return;
      }
      hasStatement = true;
      statement = value.trim();
    });
    parser.on("file", (name, stream, info) => {
      if (name !== "image" || imageChunks) {
        fail(new ApiError(400, "Send only one proof statement and one image.", "INVALID_PROOF"));
        stream.resume();
        return;
      }
      imageChunks = [];
      imageMimeType = info.mimeType;
      let size = 0;
      stream.on("data", (chunk: Buffer) => {
        size += chunk.length;
        if (size <= maxProofImageBytes) imageChunks!.push(chunk);
      });
      stream.on("limit", () => fail(new ApiError(413, "The proof image must not exceed 5 MiB.", "PROOF_IMAGE_TOO_LARGE")));
      stream.on("error", () => fail(new ApiError(400, "Could not read the proof image.", "INVALID_PROOF_IMAGE")));
      stream.on("end", () => { imageBytes = Buffer.concat(imageChunks!); });
    });
    parser.on("filesLimit", () => fail(new ApiError(400, "Send only one proof image.", "INVALID_PROOF")));
    parser.on("fieldsLimit", () => fail(new ApiError(400, "Send only one proof statement.", "INVALID_PROOF")));
    parser.on("error", () => reject(new ApiError(400, "Send a valid multipart proof form.", "INVALID_PROOF")));
    parser.on("close", async () => {
      try {
        if (parseError) throw parseError;
        const image = imageBytes ? await validateProofImage(imageBytes, imageMimeType) : undefined;
        resolve({ statement, ...(image ? { image } : {}) });
      } catch (error) {
        reject(error);
      }
    });
    request.pipe(parser);
  });
}
