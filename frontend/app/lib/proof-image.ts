export const MAX_PROOF_IMAGE_BYTES = 5 * 1024 * 1024;
export const MAX_PROOF_IMAGE_PIXELS = 40_000_000;
const supportedTypes = new Set(["image/jpeg", "image/png", "image/webp"]);

export function validateImageSelection(input: {
  type: string;
  size: number;
  width: number;
  height: number;
}): void {
  if (!supportedTypes.has(input.type)) {
    throw new Error("Choose a JPEG, PNG, or WebP image.");
  }
  if (input.size <= 0 || input.size > MAX_PROOF_IMAGE_BYTES) {
    throw new Error("The image must be no larger than 5 MiB.");
  }
  if (
    !Number.isSafeInteger(input.width) || !Number.isSafeInteger(input.height) ||
    input.width < 1 || input.height < 1 || input.width * input.height > MAX_PROOF_IMAGE_PIXELS
  ) {
    throw new Error("The image must be 40 megapixels or smaller.");
  }
}

export type SelectedProofImage = { file: File; dataUrl: string };
