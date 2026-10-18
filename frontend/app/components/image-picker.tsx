import { useRef, useState } from "react";
import { validateImageSelection, type SelectedProofImage } from "~/lib/proof-image";

export function ImagePicker({
  id,
  label = "Attach a photo",
  onChange,
}: {
  id: string;
  label?: string;
  onChange: (image: SelectedProofImage | null) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [image, setImage] = useState<SelectedProofImage | null>(null);
  const [error, setError] = useState("");

  async function choose(file?: File) {
    setError("");
    if (!file) return;
    try {
      const decoded = await createImageBitmap(file);
      try {
        validateImageSelection({
          type: file.type,
          size: file.size,
          width: decoded.width,
          height: decoded.height,
        });
      } finally {
        decoded.close();
      }
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => typeof reader.result === "string" ? resolve(reader.result) : reject(new Error("Could not read this image."));
        reader.onerror = () => reject(new Error("Could not read this image."));
        reader.readAsDataURL(file);
      });
      const next = { file, dataUrl };
      setImage(next);
      onChange(next);
      if (inputRef.current) inputRef.current.value = "";
    } catch (cause) {
      setImage(null);
      onChange(null);
      setError(cause instanceof Error ? cause.message : "Could not read this image.");
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  function remove() {
    setImage(null);
    setError("");
    if (inputRef.current) inputRef.current.value = "";
    onChange(null);
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <input
        ref={inputRef}
        id={id}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="sr-only"
        onChange={(event) => void choose(event.currentTarget.files?.[0])}
        aria-describedby={error ? `${id}-error` : undefined}
      />
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:border-indigo-400 hover:text-indigo-700 focus-visible:outline-2 focus-visible:outline-indigo-600"
      >
        <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-4 w-4">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 16V4m0 0L7.5 8.5M12 4l4.5 4.5M5 14.5v3A2.5 2.5 0 0 0 7.5 20h9a2.5 2.5 0 0 0 2.5-2.5v-3" />
        </svg>
        {image ? "Replace photo" : label}
      </button>
      {image ? (
        <>
          <img src={image.dataUrl} alt="Selected photo preview" className="h-12 w-12 rounded-lg border border-slate-200 object-cover" />
          <button type="button" onClick={remove} className="text-xs font-semibold text-slate-500 underline hover:text-rose-700">Remove</button>
        </>
      ) : null}
      {error ? <p id={`${id}-error`} role="alert" className="w-full text-xs text-rose-700">{error}</p> : null}
    </div>
  );
}
