import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/api";
import { PrintLayout, PrintPage } from "./print-layout";

type AnnualMaintenanceSummary = {
  year: number;
  months: Array<{
    month: number;
    preventive: { planned: number; achieved: number } | null;
    corrective: { total: number; achieved: number } | null;
  }>;
};

const monthNames = ["يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو", "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر"];
const rate = (total: number, achieved: number) => total > 0 ? `${((achieved / total) * 100).toFixed(2).replace(/\.00$/, "")}%` : "";

export default function AnnualMaintenanceSummaryPrintPage({ params }: { params: { type: string; year: string } }) {
  const type = params.type === "preventive" ? "preventive" : "corrective";
  const year = Number(params.year) || new Date().getFullYear();
  const preventive = type === "preventive";
  const { data } = useQuery({
    queryKey: ["print-annual-maintenance-summary", type, year],
    queryFn: () => apiRequest<AnnualMaintenanceSummary>(`/maintenance-requests/reports/annual-maintenance-summary?year=${year}`),
  });
  const title = preventive ? "الملخص السنوي للصيانة الوقائية" : "الملخص السنوي للصيانة العلاجية";

  return (
    <PrintLayout title={`${title} - Official Print`}>
      <PrintPage className="p-[12mm] text-[11pt]" dir="rtl">
        <table className="w-full border-collapse border border-black text-center"><tbody><tr>
          <td className="w-1/3 border border-black p-2 text-right font-bold">شركة بيت جالا لصناعة الأدوية<br />بيت جالا<br />فلسطين</td>
          <td className="w-1/3 border border-black p-2 text-lg font-bold">{title}<br />لسنة {year}</td>
          <td className="w-1/3 border border-black p-2 text-right"><b>رقم الوثيقة:</b> Annual Summary<br /><b>تاريخ الطباعة:</b> {new Date().toLocaleDateString("en-GB")}<br /><b>صفحة 1 من 1</b></td>
        </tr></tbody></table>

        <h2 className="my-7 text-center text-xl font-bold">{title}</h2>
        <table className="w-full border-collapse text-center text-[10pt]">
          <thead><tr className="bg-[#e6e6e6]">
            <th className="border border-black p-2">الشهر / السنة</th>
            <th className="border border-black p-2">{preventive ? "عدد نشاطات الصيانة الوقائية" : "عدد طلبات الصيانة العلاجية"}</th>
            <th className="border border-black p-2">{preventive ? "عدد نشاطات الصيانة الوقائية المنجزة" : "عدد طلبات الصيانة العلاجية المنجزة"}</th>
            <th className="border border-black p-2">نسبة الإنجاز</th>
          </tr></thead>
          <tbody>{(data?.months ?? []).map((month) => {
            const stats = preventive ? month.preventive : month.corrective;
            const total = stats ? ("planned" in stats ? stats.planned : stats.total) : null;
            return <tr key={month.month}>
              <td className="border border-black p-2">{monthNames[month.month - 1]} / {year}</td>
              <td className="border border-black p-2">{total ?? ""}</td>
              <td className="border border-black p-2">{stats?.achieved ?? ""}</td>
              <td className="border border-black p-2" dir="ltr">{stats && total !== null ? rate(total, stats.achieved) : ""}</td>
            </tr>;
          })}</tbody>
        </table>
        <p className="mt-8 text-sm">هذا الملخص مُستخرج من بيانات سجلات الصيانة المحفوظة في النظام.</p>
      </PrintPage>
    </PrintLayout>
  );
}
