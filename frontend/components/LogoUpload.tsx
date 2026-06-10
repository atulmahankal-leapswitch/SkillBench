"use client";

import { useRef, useState } from "react";
import { Button } from "./ui";

const MAX_DIM = 256; // downscale longest side to this many px

// Read an image file and return a downscaled PNG data URL.
function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Could not read file"));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error("Invalid image"));
      img.onload = () => {
        const scale = Math.min(1, MAX_DIM / Math.max(img.width, img.height));
        const w = Math.round(img.width * scale);
        const h = Math.round(img.height * scale);
        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        canvas.getContext("2d")?.drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL("image/png"));
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  });
}

export default function LogoUpload({
  value,
  onChange,
}: {
  value: string;
  onChange: (dataUrl: string) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);

  async function pick(file: File | undefined) {
    setError(null);
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setError("Please choose an image file.");
      return;
    }
    try {
      onChange(await fileToDataUrl(file));
    } catch (e) {
      setError((e as Error).message);
    }
  }

  return (
    <div>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 16,
          marginBottom: 8,
        }}
      >
        <div
          style={{
            width: 96,
            height: 96,
            borderRadius: 12,
            border: "1px dashed var(--border)",
            background: "var(--bg)",
            display: "grid",
            placeItems: "center",
            overflow: "hidden",
          }}
        >
          {value ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={value}
              alt="Logo preview"
              style={{ maxWidth: "100%", maxHeight: "100%" }}
            />
          ) : (
            <span style={{ color: "var(--muted)", fontSize: 12 }}>No logo</span>
          )}
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            style={{ display: "none" }}
            onChange={(e) => pick(e.target.files?.[0])}
          />
          <Button variant="ghost" onClick={() => inputRef.current?.click()}>
            {value ? "Change logo" : "Upload logo"}
          </Button>
          {value && (
            <Button variant="danger" onClick={() => onChange("")}>
              Remove
            </Button>
          )}
        </div>
      </div>
      <div style={{ color: "var(--muted)", fontSize: 12 }}>
        PNG/JPG/SVG. Auto-resized to {MAX_DIM}px.
      </div>
      {error && <div style={{ color: "#ff8a8a", fontSize: 13 }}>{error}</div>}
    </div>
  );
}
