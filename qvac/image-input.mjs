export const maxImageBytes = 5 * 1024 * 1024;

const signatures = {
  "image/jpeg": (bytes) => bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff,
  "image/png": (bytes) => bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])),
  "image/webp": (bytes) => bytes.length >= 12 && bytes.toString("ascii", 0, 4) === "RIFF" && bytes.toString("ascii", 8, 12) === "WEBP",
};

export function validateImageDataUrl(value) {
  if (typeof value !== "string") throw new Error("Send a valid image data URL.");
  const match = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/]+={0,2})$/.exec(value);
  if (!match) throw new Error("Use a base64 JPEG, PNG, or WebP image.");
  const bytes = Buffer.from(match[2], "base64");
  if (!bytes.length || bytes.length > maxImageBytes) throw new Error("Image must not exceed 5 MiB.");
  if (bytes.toString("base64") !== match[2] || !signatures[match[1]](bytes)) {
    throw new Error("Image data does not match its supported image type.");
  }
  return value;
}
