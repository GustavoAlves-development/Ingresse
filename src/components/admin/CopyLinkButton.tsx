"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";

type CopyState = "idle" | "copied" | "error";

export function CopyLinkButton({ url }: { url: string }) {
  const [state, setState] = useState<CopyState>("idle");

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(url);
      setState("copied");
    } catch {
      setState("error");
    } finally {
      setTimeout(() => setState("idle"), 2000);
    }
  }

  const label =
    state === "copied"
      ? "Copiado!"
      : state === "error"
        ? "Não foi possível copiar"
        : "Copiar link";

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      onClick={handleCopy}
      className="shrink-0"
    >
      {label}
    </Button>
  );
}
