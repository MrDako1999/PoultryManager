import { useRef, useEffect, useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Eraser } from 'lucide-react';

// Canvas-based driver signature pad. The canvas is the only genuinely
// new primitive in the slaughterhouse module (per plan §0.1, §0.3).
// Wrapped in the same Card + Label shell used by other sheet inputs so
// it reads consistently with the rest of the form.
//
// Captures pointer events (mouse + touch + pen via the unified Pointer
// Events API), strokes them onto a 600×220 canvas, and exposes the
// final image as a Blob via `onSave` when the parent calls saveTrigger.
// For now the parent gets the raw blob and decides whether to upload
// (storeBlob) or store inline.
export default function SignaturePad({
  label,
  required,
  onChange,
  className,
}) {
  const { t } = useTranslation();
  const canvasRef = useRef(null);
  const [hasStroke, setHasStroke] = useState(false);
  const drawingRef = useRef(false);
  const lastPointRef = useRef(null);

  const ctx = useCallback(() => canvasRef.current?.getContext('2d') || null, []);

  // Set up the canvas DPR scaling once on mount.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ratio = window.devicePixelRatio || 1;
    const cssWidth = canvas.clientWidth;
    const cssHeight = canvas.clientHeight;
    canvas.width = cssWidth * ratio;
    canvas.height = cssHeight * ratio;
    const c = canvas.getContext('2d');
    c.scale(ratio, ratio);
    c.lineCap = 'round';
    c.lineJoin = 'round';
    c.strokeStyle = 'currentColor';
    c.lineWidth = 2;
  }, []);

  const pointPos = (evt) => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    return { x: evt.clientX - rect.left, y: evt.clientY - rect.top };
  };

  const start = (evt) => {
    evt.preventDefault();
    const c = ctx();
    if (!c) return;
    drawingRef.current = true;
    const p = pointPos(evt);
    lastPointRef.current = p;
    c.beginPath();
    c.moveTo(p.x, p.y);
  };

  const move = (evt) => {
    if (!drawingRef.current) return;
    evt.preventDefault();
    const c = ctx();
    const p = pointPos(evt);
    if (!c || !p) return;
    c.lineTo(p.x, p.y);
    c.stroke();
    lastPointRef.current = p;
    if (!hasStroke) setHasStroke(true);
  };

  const end = () => {
    if (!drawingRef.current) return;
    drawingRef.current = false;
    if (!hasStroke || !canvasRef.current) return;
    canvasRef.current.toBlob((blob) => {
      if (blob && onChange) {
        onChange({
          blob,
          file: new File([blob], `signature-${Date.now()}.png`, { type: 'image/png' }),
        });
      }
    }, 'image/png');
  };

  const clear = () => {
    const canvas = canvasRef.current;
    const c = ctx();
    if (!canvas || !c) return;
    c.clearRect(0, 0, canvas.width, canvas.height);
    setHasStroke(false);
    onChange?.(null);
  };

  return (
    <div className={className}>
      <div className="flex items-center justify-between mb-1.5">
        <Label className="text-xs">
          {label}
          {required ? <span className="text-destructive ms-1">*</span> : null}
        </Label>
        {hasStroke ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-xs gap-1"
            onClick={clear}
          >
            <Eraser className="h-3.5 w-3.5" />
            {t('handovers.signatureClear', 'Clear')}
          </Button>
        ) : null}
      </div>
      <Card className="overflow-hidden">
        <canvas
          ref={canvasRef}
          className="block w-full h-[180px] touch-none cursor-crosshair text-foreground"
          onPointerDown={start}
          onPointerMove={move}
          onPointerUp={end}
          onPointerLeave={end}
          onPointerCancel={end}
        />
      </Card>
      {required && !hasStroke ? (
        <p className="text-[11px] text-destructive mt-1">
          {t('handovers.signatureRequired', 'A driver signature is required to confirm dispatch.')}
        </p>
      ) : null}
    </div>
  );
}
