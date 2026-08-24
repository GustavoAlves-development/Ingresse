"use client";

import { useState } from "react";

export function ImageUpload({
  name,
  defaultValue,
  onChange,
}: {
  name: string;
  defaultValue?: string | null;
  onChange?: (url: string) => void;
}) {
  const [url, setUrl] = useState(defaultValue ?? "");
  const [status, setStatus] = useState<"idle" | "uploading" | "error">(
    "idle",
  );

  async function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    setStatus("uploading");
    try {
      const formData = new FormData();
      formData.append("file", file);
      const response = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });
      if (!response.ok) {
        throw new Error("upload failed");
      }
      const { url: uploadedUrl } = (await response.json()) as {
        url: string;
      };
      setUrl(uploadedUrl);
      onChange?.(uploadedUrl);
      setStatus("idle");
    } catch {
      setStatus("error");
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <input type="hidden" name={name} value={url} />
      {url && (
        <img
          src={url}
          alt=""
          className="h-32 w-full rounded-lg object-cover"
        />
      )}
      <input
        type="file"
        accept="image/jpeg,image/png,image/webp"
        onChange={handleFileChange}
        disabled={status === "uploading"}
        className="text-sm text-muted-foreground file:mr-3 file:rounded-lg file:border file:border-input file:bg-transparent file:px-2.5 file:py-1 file:text-sm file:font-medium file:text-foreground"
      />
      {status === "uploading" && (
        <p className="text-sm text-muted-foreground">Enviando...</p>
      )}
      {status === "error" && (
        <p className="text-sm text-destructive">
          Falha no upload. Tente novamente.
        </p>
      )}
    </div>
  );
}
