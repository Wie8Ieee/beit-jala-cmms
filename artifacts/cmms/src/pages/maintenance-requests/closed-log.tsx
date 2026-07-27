import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Printer } from "lucide-react";
import { apiRequest } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export type ClosedCorrectiveMaintenanceLogRow = {
  id: number;
  machineName: string;
  machineNumber: string;
  requestDate: string;
  requestReportNumber: string;
  priority: string;
  closedDate: string;
  remarks: string;
};

function maintenanceType(priority: string) {
  return priority.toLowerCase() === "urgent" ? "مستعجل" : "عادي";
}

export default function ClosedCorrectiveMaintenanceLogPage() {
  const { data = [], isLoading } = useQuery({
    queryKey: ["closed-corrective-maintenance-log"],
    queryFn: () => apiRequest<ClosedCorrectiveMaintenanceLogRow[]>("/maintenance-requests/closed-log"),
  });

  return (
    <div className="mx-auto max-w-7xl space-y-6" dir="rtl">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">سجل طلبات الصيانة العلاجية للأجهزة / الماكينات</h1>
          <p className="text-muted-foreground">LOG-10-0659-0 — يتم تعبئة السجل تلقائيًا عند إغلاق طلب الصيانة.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" asChild><Link href="/maintenance-requests"><ArrowLeft className="ms-2 h-4 w-4" />العودة للطلبات</Link></Button>
          <Button variant="outline" asChild><Link href="/print/closed-corrective-maintenance-log"><Printer className="ms-2 h-4 w-4" />طباعة السجل</Link></Button>
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-right">اسم الجهاز</TableHead>
                <TableHead className="text-right">رقم الجهاز</TableHead>
                <TableHead className="text-right">التاريخ</TableHead>
                <TableHead className="text-right">رقم طلب الصيانة العلاجية</TableHead>
                <TableHead className="text-right">عادي / مستعجل</TableHead>
                <TableHead className="text-right">تاريخ إغلاق الطلب</TableHead>
                <TableHead className="text-right">ملاحظات</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? <TableRow><TableCell colSpan={7} className="h-24 text-center text-muted-foreground">جارٍ تحميل السجل…</TableCell></TableRow>
                : data.length === 0 ? <TableRow><TableCell colSpan={7} className="h-24 text-center text-muted-foreground">لا توجد طلبات صيانة علاجية مغلقة حتى الآن.</TableCell></TableRow>
                : data.map((row) => <TableRow key={row.id}>
                  <TableCell className="font-medium">{row.machineName}</TableCell>
                  <TableCell dir="ltr">{row.machineNumber}</TableCell>
                  <TableCell dir="ltr">{row.requestDate}</TableCell>
                  <TableCell dir="ltr" className="font-mono">{row.requestReportNumber}</TableCell>
                  <TableCell>{maintenanceType(row.priority)}</TableCell>
                  <TableCell dir="ltr">{row.closedDate}</TableCell>
                  <TableCell>{row.remarks || "—"}</TableCell>
                </TableRow>)}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
