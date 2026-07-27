import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";

export function SignaturePad({ value, onChange }: { value?: string | null; onChange: (data: string) => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const [hasInk, setHasInk] = useState(Boolean(value));
  useEffect(() => { if (!value || !canvasRef.current) return; const image = new Image(); image.onload = () => canvasRef.current?.getContext("2d")?.drawImage(image, 0, 0, 500, 180); image.src = value; }, [value]);
  const point = (event: React.PointerEvent<HTMLCanvasElement>) => { const rect = event.currentTarget.getBoundingClientRect(); return { x: (event.clientX - rect.left) * (500 / rect.width), y: (event.clientY - rect.top) * (180 / rect.height) }; };
  const start = (event: React.PointerEvent<HTMLCanvasElement>) => { drawing.current = true; event.currentTarget.setPointerCapture(event.pointerId); const ctx = canvasRef.current?.getContext("2d"); const p = point(event); ctx?.beginPath(); ctx?.moveTo(p.x, p.y); };
  const move = (event: React.PointerEvent<HTMLCanvasElement>) => { if (!drawing.current) return; const ctx = canvasRef.current?.getContext("2d"); const p = point(event); if (!ctx) return; ctx.lineWidth = 2.2; ctx.lineCap = "round"; ctx.strokeStyle = "#0f172a"; ctx.lineTo(p.x, p.y); ctx.stroke(); setHasInk(true); };
  const end = () => { if (!drawing.current) return; drawing.current = false; const data = canvasRef.current?.toDataURL("image/png"); if (data) onChange(data); };
  const clear = () => { const canvas = canvasRef.current; canvas?.getContext("2d")?.clearRect(0, 0, 500, 180); setHasInk(false); onChange(""); };
  return <div className="space-y-2"><canvas ref={canvasRef} width={500} height={180} className="h-36 w-full touch-none rounded-md border bg-white" onPointerDown={start} onPointerMove={move} onPointerUp={end} onPointerLeave={end} /><div className="flex items-center justify-between text-xs text-muted-foreground"><span>{hasInk ? "تم رسم التوقيع" : "ارسم توقيعك داخل المربع"}</span><Button type="button" variant="outline" size="sm" onClick={clear}>مسح</Button></div></div>;
}
