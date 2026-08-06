import { useQuery } from "@tanstack/react-query";
import { Bar, BarChart, CartesianGrid, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { apiRequest } from "@/lib/api";
import { useLang } from "@/contexts/LanguageContext";
import { PrintLayout, PrintPage } from "./print-layout";

type AnnualMaintenanceSummary = {
  year: number;
  months: Array<{
    month: number;
    preventive: { planned: number; achieved: number } | null;
    corrective: { total: number; achieved: number } | null;
  }>;
};

const arabicMonthNames = ["يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو", "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر"];
const englishMonthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const rate = (total: number, achieved: number) => total > 0 ? `${((achieved / total) * 100).toFixed(2).replace(/\.00$/, "")}%` : "";

export default function AnnualMaintenanceSummaryPrintPage({ params }: { params: { type: string; year: string } }) {
  const { isArabic } = useLang();
  const type = params.type === "preventive" ? "preventive" : "corrective";
  const year = Number(params.year) || new Date().getFullYear();
  const preventive = type === "preventive";
  const { data } = useQuery({
    queryKey: ["print-annual-maintenance-summary", type, year],
    queryFn: () => apiRequest<AnnualMaintenanceSummary>(`/maintenance-requests/reports/annual-maintenance-summary?year=${year}`),
  });
  const monthNames = isArabic ? arabicMonthNames : englishMonthNames;
  const copy = isArabic ? {
    title: preventive ? "الملخص السنوي للصيانة الوقائية" : "الملخص السنوي للصيانة العلاجية",
    company: "شركة بيت جالا لصناعة الأدوية", city: "بيت جالا", country: "فلسطين", document: "رقم الوثيقة", printDate: "تاريخ الطباعة", page: "صفحة 1 من 1",
    forYear: "لسنة", monthYear: "الشهر / السنة", total: preventive ? "عدد نشاطات الصيانة الوقائية" : "عدد طلبات الصيانة العلاجية",
    achieved: preventive ? "عدد نشاطات الصيانة الوقائية المنجزة" : "عدد طلبات الصيانة العلاجية المنجزة", rate: "نسبة الإنجاز",
    chart: preventive ? "% من إنجاز أنشطة الصيانة الوقائية الشهرية" : "% من إنجاز طلبات الصيانة العلاجية الشهرية",
    axis: preventive ? "أنشطة الصيانة الوقائية" : "طلبات الصيانة العلاجية", systemNote: "هذا الملخص مُستخرج من بيانات سجلات الصيانة المحفوظة في النظام.",
  } : {
    title: preventive ? "Annual Preventive Maintenance Summary" : "Annual Corrective Maintenance Summary",
    company: "Beit Jala Pharmaceutical Co.", city: "Beit Jala", country: "Palestine", document: "Doc. No.", printDate: "Print Date", page: "Page 1 of 1",
    forYear: "For Year", monthYear: "Month / Year", total: preventive ? "# of preventive maintenance activities" : "# of corrective maintenance requests",
    achieved: preventive ? "# of preventive maintenance activities achieved" : "# of corrective maintenance requests achieved", rate: "Completion Rate",
    chart: preventive ? "% of monthly preventive maintenance achievement chart" : "% of monthly corrective maintenance achievement chart",
    axis: preventive ? "Preventive activities" : "Corrective requests", systemNote: "This summary is generated from maintenance records saved in the system.",
  };
  const chartRows = (data?.months ?? []).map((month) => {
    const stats = preventive ? month.preventive : month.corrective;
    const total = stats ? ("planned" in stats ? stats.planned : stats.total) : 0;
    const achieved = stats?.achieved ?? 0;
    return { month: `${monthNames[month.month - 1]} ${year}`, total, achieved, completion: total ? rate(total, achieved) : "" };
  });

  return (
    <PrintLayout title={`${copy.title} - Official Print`}>
      <PrintPage className="annual-maintenance-summary-print overflow-hidden px-[9mm] pb-[9mm] text-[10pt]" dir={isArabic ? "rtl" : "ltr"}>
        <h1 className="mb-5 text-center text-[18pt] font-bold leading-tight">{copy.title} — {copy.forYear} {year}</h1>
        <table className="mx-auto w-[calc(100%-1mm)] table-fixed border-collapse border border-black text-center text-[8.5pt] leading-tight">
          <thead><tr className="bg-[#e6e6e6]">
            <th className="w-[16%] break-words border border-black p-1.5">{copy.monthYear}</th>
            <th className="w-[31%] break-words border border-black p-1.5">{copy.total}</th>
            <th className="w-[37%] break-words border border-black p-1.5">{copy.achieved}</th>
            <th className="w-[16%] break-words border border-black p-1.5">{copy.rate}</th>
          </tr></thead>
          <tbody>{(data?.months ?? []).map((month) => {
            const stats = preventive ? month.preventive : month.corrective;
            const total = stats ? ("planned" in stats ? stats.planned : stats.total) : null;
            return <tr key={month.month}>
              <td className="border border-black p-1.5">{monthNames[month.month - 1]} / {year}</td>
              <td className="border border-black p-1.5">{total ?? ""}</td>
              <td className="border border-black p-1.5">{stats?.achieved ?? ""}</td>
              <td className="border border-black p-1.5" dir="ltr">{stats && total !== null ? rate(total, stats.achieved) : ""}</td>
            </tr>;
          })}</tbody>
        </table>
        <div className="mt-5 h-[128mm] overflow-hidden bg-white p-4" dir="ltr">
          <h3 className="mb-3 text-center text-[14pt] font-bold">{copy.chart}</h3>
          <div className="relative h-[80%]">
            <div className="pointer-events-none absolute bottom-[94px] left-5 z-10 whitespace-nowrap text-[13px] font-bold text-slate-900 [writing-mode:vertical-rl] rotate-180">
              {copy.total}
            </div>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartRows} margin={{ top: 30, right: 26, left: 72, bottom: 58 }} barCategoryGap="28%" barGap={6}>
              <CartesianGrid stroke="#cbd5e1" vertical={false} />
              <XAxis
                dataKey="month"
                interval={0}
                angle={-35}
                textAnchor="end"
                height={72}
                tick={{ fontSize: 11, fill: "#1e293b" }}
              />
              <YAxis allowDecimals={false} />
              <Tooltip />
              <Bar dataKey="total" name={copy.total} fill="#174b72" stroke="#123b5a" barSize={22}>
                <LabelList
                  dataKey="completion"
                  content={({ x, y, width, value }: any) => value ? (
                    <text x={Number(x) + Number(width) + 4} y={Number(y) - 10} textAnchor="middle" fill="#b91c1c" fontSize={14} fontWeight={800}>
                      {value}
                    </text>
                  ) : null}
                />
              </Bar>
              <Bar dataKey="achieved" name={copy.achieved} fill="#2aa198" stroke="#208078" barSize={22} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="relative -top-12 text-center text-[13pt] font-bold">{copy.monthYear}</div>
          <div className="mt-2 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-[12pt] font-medium">
            <span className="inline-flex items-center gap-1.5 text-[#174b72]"><span aria-hidden="true" className="inline-block text-[15pt] leading-none">■</span>{copy.total}</span>
            <span className="inline-flex items-center gap-1.5 text-[#2aa198]"><span aria-hidden="true" className="inline-block text-[15pt] leading-none">■</span>{copy.achieved}</span>
          </div>
        </div>
      </PrintPage>
    </PrintLayout>
  );
}
