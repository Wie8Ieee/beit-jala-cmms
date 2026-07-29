import { Button } from "@/components/ui/button";
import { ArrowLeft, Printer } from "lucide-react";
import { useState } from "react";

type PrintLayoutProps = {
  children: React.ReactNode;
  title: string;
  toolbarActions?: React.ReactNode;
  landscape?: boolean;
  showOrientationChoice?: boolean;
  orientation?: "portrait" | "landscape";
  onOrientationChange?: (orientation: "portrait" | "landscape") => void;
};

export function PrintLayout({
  children,
  title,
  toolbarActions,
  landscape = false,
  showOrientationChoice = false,
  orientation,
  onOrientationChange,
}: PrintLayoutProps) {
  const [selectedOrientation, setSelectedOrientation] = useState<"portrait" | "landscape">(
    landscape ? "landscape" : "portrait",
  );
  const activeOrientation = orientation ?? selectedOrientation;
  const printLandscape = showOrientationChoice ? activeOrientation === "landscape" : landscape;

  const handlePrint = () => {
    if (!printLandscape) {
      window.print();
      return;
    }

    // Add the print-page instruction immediately before printing. This is more
    // reliable in Chromium's print preview than relying only on route CSS.
    const style = document.createElement("style");
    style.media = "print";
    style.textContent = "@page { size: 297mm 210mm; margin: 12mm; }";
    document.head.appendChild(style);

    const cleanup = () => {
      style.remove();
      window.removeEventListener("afterprint", cleanup);
    };
    window.addEventListener("afterprint", cleanup);

    // Give the browser time to apply the new page size before it snapshots
    // the document for the print preview.
    window.setTimeout(() => window.print(), 250);
  };

  return (
    <div className={`official-print-layout min-h-screen bg-slate-100 py-6 text-black print:bg-white print:py-0${printLandscape ? " official-print-layout-landscape" : ""}`}>
      <div className="mx-auto mb-4 flex max-w-[210mm] items-center justify-between print:hidden">
        <div className="flex items-center gap-3">
          <Button variant="outline" size="icon" onClick={() => window.history.back()} aria-label="Back">
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <h1 className="text-xl font-semibold">{title}</h1>
        </div>
        <div className="flex items-center gap-2">
          {toolbarActions}
          {showOrientationChoice && (
            <label className="flex items-center gap-2 text-sm font-medium">
              Print orientation
              <select
                value={activeOrientation}
                onChange={(event) => {
                  const nextOrientation = event.target.value as "portrait" | "landscape";
                  setSelectedOrientation(nextOrientation);
                  onOrientationChange?.(nextOrientation);
                }}
                className="h-10 rounded-md border border-input bg-background px-3 text-sm shadow-sm"
              >
                <option value="portrait">Portrait</option>
                <option value="landscape">Landscape</option>
              </select>
            </label>
          )}
          <Button onClick={handlePrint}>
            <Printer className="mr-2 h-4 w-4" />
            Print / Save PDF
          </Button>
        </div>
      </div>
      {children}
    </div>
  );
}

export function PrintPage({ children, landscape = false, className = "" }: { children: React.ReactNode; landscape?: boolean; className?: string }) {
  return (
    <div className={`${landscape ? "official-print-page official-print-landscape" : "official-print-page"} ${className}`}>
      {children}
    </div>
  );
}

export function OfficialPrintHeader({
  title,
  documentNumber,
  effectiveDate,
  page = "Page 1 of 1",
}: {
  title: string;
  documentNumber: string;
  effectiveDate?: string | null;
  page?: string;
}) {
  return (
    <table className="official-print-table official-print-header-table">
      <tbody>
        <tr>
          <td className="w-[34%] text-left font-semibold">
            Beit Jala Pharmaceutical Co.
            <br />
            Beit Jala
            <br />
            Palestine
          </td>
          <td className="w-[33%] text-center font-semibold">{title}</td>
          <td className="w-[33%] text-left">
            <div><strong>Doc. No.:</strong> {documentNumber}</div>
            <div><strong>Effective Date:</strong> {effectiveDate || ""}</div>
            <div><strong>{page}</strong></div>
          </td>
        </tr>
      </tbody>
    </table>
  );
}

export function DottedLine({ text }: { text?: string | null }) {
  return <span className="official-print-line">{text || ""}</span>;
}
