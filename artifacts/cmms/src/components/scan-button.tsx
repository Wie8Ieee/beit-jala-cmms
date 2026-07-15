import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { ScanLine, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

export type ScanFormType = "machine" | "spare-part" | "maintenance-request";

interface ScanButtonProps {
  formType: ScanFormType;
  onScanned: (data: Record<string, string>) => void;
  label?: string;
}

export function ScanButton({ formType, onScanned, label = "Scan" }: ScanButtonProps) {
  const { toast } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [isScanning, setIsScanning] = useState(false);

  async function handleFile(file: File) {
    setIsScanning(true);
    try {
      const body = new FormData();
      body.append("image", file);
      const res = await fetch(`${BASE}/api/scan?formType=${formType}`, {
        method: "POST",
        credentials: "include",
        body,
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error((err as { error?: string }).error ?? res.statusText);
      }
      const data = await res.json() as Record<string, string>;
      onScanned(data);
      toast({ title: "Scan complete", description: "Fields filled from image." });
    } catch (err) {
      toast({ variant: "destructive", title: "Scan Failed", description: String(err) });
    } finally {
      setIsScanning(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  return (
    <>
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
      />
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={isScanning}
        onClick={() => fileRef.current?.click()}
        className="gap-2"
      >
        {isScanning ? <Loader2 className="h-4 w-4 animate-spin" /> : <ScanLine className="h-4 w-4" />}
        {isScanning ? "Scanning…" : label}
      </Button>
    </>
  );
}
