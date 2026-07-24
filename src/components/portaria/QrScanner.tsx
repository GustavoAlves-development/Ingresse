"use client";

import jsQR from "jsqr";
import { useCallback, useEffect, useRef, useState } from "react";

type ScanResult = {
  result: "SUCCESS" | "ALREADY_USED" | "INVALID";
  buyerName: string | null;
};

const RESULT_STYLES: Record<ScanResult["result"], string> = {
  SUCCESS:
    "border-green-500 bg-green-950 text-green-400 shadow-[0_0_30px_rgba(34,197,94,0.5)]",
  ALREADY_USED:
    "border-red-500 bg-red-950 text-red-400 shadow-[0_0_30px_rgba(239,68,68,0.5)] animate-pulse",
  INVALID:
    "border-red-500 bg-red-950 text-red-400 shadow-[0_0_30px_rgba(239,68,68,0.5)] animate-pulse",
};

const RESULT_LABELS: Record<ScanResult["result"], string> = {
  SUCCESS: "Ingresso válido",
  ALREADY_USED: "Ingresso já utilizado",
  INVALID: "Ingresso inválido",
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
      const response = await fetch("/api/tickets/validate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ qrToken }),
      });
      const body = await response.json();
      setScanResult({ result: body.result, buyerName: body.buyerName ?? null });
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
      {cameraError && <p className="text-sm text-red-500">{cameraError}</p>}
      <video ref={videoRef} muted playsInline className="w-full rounded" />
      <canvas ref={canvasRef} className="hidden" />
      {scanResult && (
        <div
          className={`rounded border-2 p-4 text-center text-lg font-semibold ${RESULT_STYLES[scanResult.result]}`}
        >
          <p>{RESULT_LABELS[scanResult.result]}</p>
          {scanResult.buyerName && (
            <p className="text-base font-normal">{scanResult.buyerName}</p>
          )}
          <button
            type="button"
            onClick={() => setScanResult(null)}
            className="mt-4 rounded bg-blue-600 px-3 py-2 text-sm font-normal text-white"
          >
            Escanear próximo
          </button>
        </div>
      )}
    </div>
  );
}
