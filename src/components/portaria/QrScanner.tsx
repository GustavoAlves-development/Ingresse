"use client";

import jsQR from "jsqr";
import { CircleAlert, CircleCheckBig } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { TicketPerforation } from "@/components/tickets/TicketPerforation";

type ScanResult = {
  result: "SUCCESS" | "ALREADY_USED" | "INVALID" | "ERROR";
  buyerName: string | null;
};

const SUCCESS_GLOW =
  "shadow-[0_0_30px_color-mix(in_oklch,var(--success)_55%,transparent)]";
const DANGER_GLOW =
  "shadow-[0_0_30px_color-mix(in_oklch,var(--destructive)_55%,transparent)]";

const RESULT_STYLES: Record<ScanResult["result"], string> = {
  SUCCESS: `border-success/40 bg-success/10 text-success ${SUCCESS_GLOW}`,
  ALREADY_USED: `border-destructive/40 bg-destructive/10 text-destructive ${DANGER_GLOW}`,
  INVALID: `border-destructive/40 bg-destructive/10 text-destructive ${DANGER_GLOW}`,
  ERROR: `border-destructive/40 bg-destructive/10 text-destructive ${DANGER_GLOW}`,
};

const RESULT_LABELS: Record<ScanResult["result"], string> = {
  SUCCESS: "Ingresso válido",
  ALREADY_USED: "Ingresso já utilizado",
  INVALID: "Ingresso inválido",
  ERROR: "Erro ao validar. Tente novamente.",
};

// Ícone pulsante nos estados de alerta (spec, seção 7) — reforça a leitura
// à distância na portaria. Sucesso não pulsa, só o alerta precisa chamar
// atenção ativamente.
const RESULT_ICONS: Record<ScanResult["result"], typeof CircleCheckBig> = {
  SUCCESS: CircleCheckBig,
  ALREADY_USED: CircleAlert,
  INVALID: CircleAlert,
  ERROR: CircleAlert,
};

const RESULT_ICON_CLASSES: Record<ScanResult["result"], string> = {
  SUCCESS: "",
  ALREADY_USED: "motion-safe:animate-pulse",
  INVALID: "motion-safe:animate-pulse",
  ERROR: "motion-safe:animate-pulse",
};

export function QrScanner() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const scanResultRef = useRef<ScanResult | null>(null);
  const validatingRef = useRef(false);

  const [scanResult, setScanResult] = useState<ScanResult | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);

  useEffect(() => {
    scanResultRef.current = scanResult;
  }, [scanResult]);

  const validateToken = useCallback(async (qrToken: string) => {
    validatingRef.current = true;
    try {
      try {
        const response = await fetch("/api/tickets/validate", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ qrToken }),
        });
        if (!response.ok) {
          setScanResult({ result: "ERROR", buyerName: null });
          return;
        }
        const body = await response.json();
        const validResults = ["SUCCESS", "ALREADY_USED", "INVALID"] as const;
        if (validResults.includes(body.result)) {
          setScanResult({ result: body.result, buyerName: body.buyerName ?? null });
        } else {
          setScanResult({ result: "ERROR", buyerName: null });
        }
      } catch {
        setScanResult({ result: "ERROR", buyerName: null });
      }
    } finally {
      validatingRef.current = false;
    }
  }, []);

  useEffect(() => {
    let animationFrameId: number;
    let stream: MediaStream | null = null;
    let cancelled = false;

    function tick() {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      if (
        video &&
        canvas &&
        video.readyState === video.HAVE_ENOUGH_DATA &&
        !scanResultRef.current &&
        !validatingRef.current
      ) {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const context = canvas.getContext("2d");
        if (context) {
          context.drawImage(video, 0, 0, canvas.width, canvas.height);
          const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
          const code = jsQR(imageData.data, imageData.width, imageData.height);
          if (code?.data) {
            void validateToken(code.data);
          }
        }
      }
      animationFrameId = requestAnimationFrame(tick);
    }

    async function startCamera() {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment" },
        });
        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }
        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }
        animationFrameId = requestAnimationFrame(tick);
      } catch {
        setCameraError("Não foi possível acessar a câmera.");
      }
    }

    startCamera();

    return () => {
      cancelled = true;
      cancelAnimationFrame(animationFrameId);
      stream?.getTracks().forEach((track) => track.stop());
    };
  }, [validateToken]);

  return (
    <div className="flex flex-col gap-4">
      {cameraError && (
        <p className="text-sm text-destructive">{cameraError}</p>
      )}
      <video
        ref={videoRef}
        muted
        playsInline
        className="w-full rounded-xl"
      />
      <canvas ref={canvasRef} className="hidden" />
      {scanResult && (
        <div
          className={`[--card-spacing:--spacing(4)] rounded-xl border-2 p-(--card-spacing) text-center text-lg font-semibold ${RESULT_STYLES[scanResult.result]}`}
        >
          {(() => {
            const ResultIcon = RESULT_ICONS[scanResult.result];
            return (
              <ResultIcon
                aria-hidden="true"
                className={`mx-auto mb-2 size-10 ${RESULT_ICON_CLASSES[scanResult.result]}`}
              />
            );
          })()}
          <p className="font-heading">{RESULT_LABELS[scanResult.result]}</p>
          {scanResult.buyerName && (
            <>
              <TicketPerforation />
              <p className="text-base font-normal text-foreground">
                {scanResult.buyerName}
              </p>
            </>
          )}
          <Button
            type="button"
            onClick={() => setScanResult(null)}
            className="mt-4"
          >
            Escanear próximo
          </Button>
        </div>
      )}
    </div>
  );
}
