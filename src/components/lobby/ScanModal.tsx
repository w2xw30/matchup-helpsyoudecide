import { useEffect, useRef, useState } from "react";
import { ImagePlus, X } from "lucide-react";
import { decodeQr, decodeQrFromFile, parseScan, type ScanTarget } from "../../lib/scan";
import { Button, Modal } from "../ui/ui";

/** Point the phone camera at a lobby's QR code to join. Falls back to picking a photo of it. */
export function ScanModal({ open, onClose, onTarget }: { open: boolean; onClose: () => void; onTarget: (t: ScanTarget) => void }) {
  return (
    <Modal open={open} onClose={onClose} label="Scan a QR code">
      <ScanBody onClose={onClose} onTarget={onTarget} />
    </Modal>
  );
}

function ScanBody({ onClose, onTarget }: { onClose: () => void; onTarget: (t: ScanTarget) => void }) {
  const video = useRef<HTMLVideoElement>(null);
  const file = useRef<HTMLInputElement>(null);
  const [msg, setMsg] = useState("Starting the camera…");
  const [err, setErr] = useState(false);

  const handle = (text: string) => {
    const t = parseScan(text);
    if (!t) {
      setErr(true);
      setMsg("That QR code isn't a Matchup invite.");
      return false;
    }
    onTarget(t);
    return true;
  };

  useEffect(() => {
    let stream: MediaStream | null = null;
    let raf = 0;
    let stopped = false;
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d", { willReadFrequently: true });

    async function start() {
      if (!navigator.mediaDevices?.getUserMedia) {
        setErr(true);
        setMsg("The camera needs a secure (https) connection. You can scan from a photo instead.");
        return;
      }
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: "environment" } }, audio: false });
        if (stopped) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        const v = video.current;
        if (!v) return;
        v.srcObject = stream;
        await v.play().catch(() => undefined);
        setMsg("Point the camera at the QR code");
        let last = 0;
        const tick = (now: number) => {
          if (stopped) return;
          raf = requestAnimationFrame(tick);
          if (now - last < 160 || !v.videoWidth || !ctx) return;
          last = now;
          const scale = Math.min(1, 520 / Math.max(v.videoWidth, v.videoHeight));
          canvas.width = Math.round(v.videoWidth * scale);
          canvas.height = Math.round(v.videoHeight * scale);
          ctx.drawImage(v, 0, 0, canvas.width, canvas.height);
          const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
          const text = decodeQr(img.data, canvas.width, canvas.height);
          if (text && parseScan(text)) {
            stopped = true;
            handle(text);
          }
        };
        raf = requestAnimationFrame(tick);
      } catch (e) {
        setErr(true);
        const name = (e as DOMException).name;
        setMsg(
          name === "NotAllowedError"
            ? "Camera permission was denied. Allow it in your browser settings, or scan from a photo."
            : name === "NotFoundError"
              ? "No camera found. You can scan from a photo instead."
              : "Couldn't start the camera. You can scan from a photo instead.",
        );
      }
    }
    void start();
    return () => {
      stopped = true;
      cancelAnimationFrame(raf);
      stream?.getTracks().forEach((t) => t.stop());
    };
    // handle only closes over stable props
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="sheet scan-sheet">
      <button type="button" className="modal-x" onClick={onClose} aria-label="Close">
        <X size={16} />
      </button>
      <h3>Scan to join</h3>
      <div className="scan-video">
        <video ref={video} muted playsInline aria-label="Camera preview" />
        <span className="scan-frame" />
      </div>
      <p className={`scan-msg ${err ? "err" : ""}`} role="status">
        {msg}
      </p>
      <input
        ref={file}
        type="file"
        accept="image/*"
        capture="environment"
        hidden
        onChange={async (e) => {
          const f = e.target.files?.[0];
          e.target.value = "";
          if (!f) return;
          try {
            const text = await decodeQrFromFile(f);
            if (!text) {
              setErr(true);
              setMsg("Couldn't find a QR code in that photo.");
            } else handle(text);
          } catch {
            setErr(true);
            setMsg("Couldn't read that image.");
          }
        }}
      />
      <Button variant="soft" pill onClick={() => file.current?.click()}>
        <ImagePlus size={15} /> Scan from a photo
      </Button>
    </div>
  );
}
