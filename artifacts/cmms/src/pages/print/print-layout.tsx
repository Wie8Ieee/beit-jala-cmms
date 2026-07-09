import { Button } from "@/components/ui/button";
import { Printer } from "lucide-react";

type PrintLayoutProps = {
  children: React.ReactNode;
  title: string;
};

export function PrintLayout({ children, title }: PrintLayoutProps) {
  return (
    <div className="min-h-screen bg-slate-100 py-6 text-black print:bg-white print:py-0">
      <div className="mx-auto mb-4 flex max-w-[210mm] items-center justify-between print:hidden">
        <h1 className="text-xl font-semibold">{title}</h1>
        <Button onClick={() => window.print()}>
          <Printer className="mr-2 h-4 w-4" />
          Print / Save PDF
        </Button>
      </div>
      {children}
    </div>
  );
}

export function PrintPage({ children, landscape = false }: { children: React.ReactNode; landscape?: boolean }) {
  return (
    <div className={landscape ? "official-print-page official-print-landscape" : "official-print-page"}>
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
