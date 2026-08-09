import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/api";
import { PrintLayout, PrintPage } from "./print-layout";

type Report = Record<string, string | number | null | undefined>;
type PrintRow = Record<string, string>;
type ElectronicSignature = { fieldName: string; signatureData: string | null; userName: string; signedAt: string };
const months = ["يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو", "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر"];
const numberValue = (value: unknown) => {
  const number = Number(value);
  return value === null || value === undefined || value === "" || number === 0 ? "" : String(value);
};
const ratio = (part: unknown, total: unknown) => {
  const numerator = Number(part);
  const denominator = Number(total);
  return denominator > 0 && numerator > 0 ? ((numerator / denominator) * 100).toFixed(1) : "";
};
function rowsFrom(value: unknown, keys: string[], legacy?: PrintRow): PrintRow[] {
  if (typeof value === "string" && value) {
    try {
      const rows = JSON.parse(value);
      if (Array.isArray(rows)) return rows
        .map((row) => Object.fromEntries(keys.map((key) => [key, String(row?.[key] ?? "")])))
        .filter((row) => Object.values(row).some((cell) => cell.trim() !== ""));
    } catch { /* Legacy report values are displayed as one row. */ }
    return [{ ...Object.fromEntries(keys.map((key) => [key, ""])), ...(legacy ?? { [keys[0]]: value }) }];
  }
  return legacy && Object.values(legacy).some(Boolean) ? [{ ...Object.fromEntries(keys.map((key) => [key, ""])), ...legacy }] : [];
}
function Box({ selected, label }: { selected: boolean; label: string }) { return <span className="evaluation-choice">{label}<i>{selected ? "✓" : ""}</i></span>; }
function Header({ page }: { page: 1 | 2 }) {
  return <table className="evaluation-header" dir="ltr"><tbody><tr>
    <td dir="rtl"><b>رقم الوثيقة: FORM-10-0944-0</b><br /><b>تاريخ التنفيذ: 18/3/2023</b><br /><b>ص {page} من 2</b></td>
    <td dir="rtl" className="evaluation-title">تقرير تقييم أعمال الصيانة الشهرية</td>
    <td dir="rtl" className="evaluation-company">شركة بيت جالا لصناعة الأدوية<br />بيت جالا<br />فلسطين</td>
  </tr></tbody></table>;
}
function Answer({ value }: { value: unknown }) { return <span className="evaluation-answer"><Box label="نعم" selected={value === "نعم"} /><Box label="لا" selected={value === "لا"} /></span>; }
function signatureDate(value?: string) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return `${String(date.getDate()).padStart(2, "0")}/${String(date.getMonth() + 1).padStart(2, "0")}/${date.getFullYear()}`;
}

export default function MonthlyMaintenanceEvaluationPrintPage({ params }: { params: { year: string; month: string } }) {
  const year = Number(params.year), month = Number(params.month);
  const { data } = useQuery({ queryKey: ["print-monthly-evaluation", year, month], queryFn: () => apiRequest<Report>(`/maintenance-requests/reports/monthly-maintenance-evaluation?year=${year}&month=${month}`) });
  const reportId = Number(data?.id ?? 0);
  const { data: signatures = [] } = useQuery({
    queryKey: ["print-monthly-evaluation-signatures", reportId],
    queryFn: () => apiRequest<ElectronicSignature[]>(`/signatures?documentType=MONTHLY_MAINTENANCE_EVALUATION&documentId=${reportId}`),
    enabled: reportId > 0,
  });
  const preparedBySignature = signatures.find((signature) => signature.fieldName === "prepared_by");
  const engineeringManagerSignature = signatures.find((signature) => signature.fieldName === "engineering_manager");
  const delayedRows = rowsFrom(data?.delayedActivities, ["activity", "reason"], { activity: String(data?.delayedActivities ?? ""), reason: String(data?.delayReason ?? "") });
  const correctiveRows = rowsFrom(data?.correctiveMaintenanceDetails, ["machineArea", "requestNo", "reason"]);
  const externalRows = rowsFrom(data?.externalMaintenanceDetails, ["requestNo", "activities", "reason", "performer"]);
  return <PrintLayout title="Monthly Maintenance Evaluation - Official Print">
    <PrintPage className="evaluation-print-page"><div className="evaluation-form" dir="rtl">
      <Header page={1} />
      <p className="evaluation-month"><b>الشهر / السنة:</b> {months[month - 1]} / {year}</p>
      <p className="evaluation-question"><b>(1)</b> أعمال الصيانة الوقائية المجدولة في هذا الشهر والتي لم يتم تنفيذها:</p>
      <table className="evaluation-table"><thead><tr><th>نشاطات أعمال الصيانة</th><th>سبب التأخير</th></tr></thead><tbody>{delayedRows.map((row, index) => <tr key={index}><td>{row.activity}</td><td>{row.reason}</td></tr>)}</tbody></table>
      <div className="evaluation-question evaluation-question-two"><p><b>(2)</b> هل تم جدولة جميع هذه النشاطات في برنامج الصيانة الوقائية الشهرية للشهر القادم؟</p><Answer value={data?.followUpIncluded} /></div>
      <p className="evaluation-question"><b>(3)</b> النسبة المئوية لإنجاز برنامج الصيانة الوقائية الشهرية:<br /><span className="evaluation-formula">(عدد نشاطات الصيانة الوقائية التي طُبقت / عدد النشاطات التي خُطّط لها) × 100% ={ratio(data?.completedPmOnTime, data?.totalPmActivities) ? ` ${ratio(data?.completedPmOnTime, data?.totalPmActivities)}%` : ""}</span></p>
      <div className="evaluation-question"><p><b>(4)</b> هل هناك أي منتج تم رفضه نتيجة أعمال الصيانة في منطقة الإنتاج؟</p><Answer value={data?.productionImpact} /></div>
      <div className="evaluation-question"><p><b>(5)</b> هل حدث أن وقع نفس العطل لنفس الماكينة خلال شهر من تاريخ إصلاح العطل؟</p><Answer value={data?.sparePartShortage} /></div>
      <section className="evaluation-section-six">
        <p className="evaluation-question"><b>(6)</b> عدد طلبات الصيانة العلاجية خلال هذا الشهر = {numberValue(data?.totalCorrectiveRequests)}</p>
        <p className="evaluation-question">عدد طلبات الصيانة العلاجية التي لم يتم إنجازها بعد (لم يتم إغلاقها) = {numberValue(data?.unclosedCorrectiveRequests)}</p>
        <p className="evaluation-formula">النسبة المئوية للصيانة العلاجية المنجزة = (عدد الطلبات المنجزة / عدد طلبات الصيانة العلاجية خلال هذا الشهر) × 100% ={ratio(data?.completedCorrectiveRequests, data?.totalCorrectiveRequests) ? ` ${ratio(data?.completedCorrectiveRequests, data?.totalCorrectiveRequests)}%` : ""}</p>
        <table className="evaluation-table evaluation-delay-table"><thead><tr><th>اسم الماكينة / منطقة العمل</th><th>رقم أمر / طلب الصيانة</th><th>سبب التأخير</th></tr></thead><tbody>{correctiveRows.map((row, index) => <tr key={index}><td>{row.machineArea}</td><td>{row.requestNo}</td><td>{row.reason}</td></tr>)}</tbody></table>
      </section>
      <p className="evaluation-question"><b>(7)</b> عدد طلبات الصيانة الخارجية = {numberValue(data?.totalExternalActivities)}</p>
      <table className="evaluation-table evaluation-external"><thead><tr><th>رقم أمر / طلب الصيانة</th><th>نشاطات أعمال الصيانة الخارجية</th><th>أسباب إرسالها للصيانة العلاجية</th><th>اسم القائم بالعمل</th></tr></thead><tbody>{externalRows.map((row, index) => <tr key={index}><td>{row.requestNo}</td><td>{row.activities}</td><td>{row.reason}</td><td>{row.performer}</td></tr>)}</tbody></table>
      <div className="evaluation-signatures">
        <div className="evaluation-signature-row"><span><b>إعداد:</b> {data?.preparedBy ?? ""}{preparedBySignature?.signatureData && <img src={preparedBySignature.signatureData} alt="توقيع مُعدّ التقرير" className="evaluation-electronic-signature" />}</span><span><b>التاريخ:</b> {typeof data?.preparedDate === "string" && data.preparedDate ? data.preparedDate.split("-").reverse().join("/") : signatureDate(preparedBySignature?.signedAt)}</span></div>
        <div className="evaluation-signature-row"><span><b>توقيع مدير دائرة الهندسة:</b> {engineeringManagerSignature?.signatureData ? <img src={engineeringManagerSignature.signatureData} alt="توقيع مدير دائرة الهندسة" className="evaluation-electronic-signature" /> : (data?.engineeringManagerSignature ?? "")}</span><span><b>التاريخ:</b> {typeof data?.engineeringManagerDate === "string" && data.engineeringManagerDate ? data.engineeringManagerDate.split("-").reverse().join("/") : signatureDate(engineeringManagerSignature?.signedAt)}</span></div>
      </div>
    </div></PrintPage>
  </PrintLayout>;
}
