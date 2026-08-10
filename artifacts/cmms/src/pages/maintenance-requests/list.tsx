import { useEffect, useState } from "react";
import { Link, useLocation } from "wouter";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { apiRequest } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Archive, ArrowLeft, BookOpen, Plus, Save } from "lucide-react";
import type { MaintenanceRequestSummary } from "./types";

function titleForScope(scope: string, t: (k: string) => string) {
  if (scope === "own") return t("maintenanceRequests.myRequests");
  if (scope === "qa") return t("maintenanceRequests.qaQueue");
  if (scope === "engineering") return t("maintenanceRequests.engineeringQueue");
  if (scope === "technician") return t("maintenanceRequests.technicianQueue");
  if (scope === "archived") return t("maintenanceRequests.archivedTitle");
  return t("maintenanceRequests.title");
}

function StatusBadge({ status }: { status: string }) {
  const { t } = useTranslation();
  const key = `maintenanceRequests.status.${status}`;
  const label = t(key) === key ? status : t(key);
  return <Badge variant="secondary">{label}</Badge>;
}

export default function MaintenanceRequestsListPage({ scope = "all" }: { scope?: string }) {
  const { hasPermission } = useAuth();
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [, navigate] = useLocation();
  const canSetNumberingStart = hasPermission("set_maintenance_request_number_start");
  const [numberingStart, setNumberingStart] = useState("");
  const { data = [], isLoading } = useQuery({
    queryKey: ["maintenance-requests", scope],
    queryFn: () => apiRequest<MaintenanceRequestSummary[]>(`/maintenance-requests?scope=${scope}`),
  });
  const { data: numberingSetting } = useQuery({
    queryKey: ["maintenance-request-numbering-start"],
    queryFn: () => apiRequest<{ lastSequence: number | null; nextNumber: string | null }>("/maintenance-requests/numbering-start"),
    enabled: canSetNumberingStart,
  });
  useEffect(() => {
    if (numberingSetting?.lastSequence !== null && numberingSetting?.lastSequence !== undefined) {
      setNumberingStart(String(numberingSetting.lastSequence));
    }
  }, [numberingSetting]);
  const saveNumberingStart = useMutation({
    mutationFn: () => apiRequest<{ lastSequence: number; nextNumber: string | null }>("/maintenance-requests/numbering-start", {
      method: "PUT",
      body: JSON.stringify({ lastSequence: numberingStart }),
    }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["maintenance-request-numbering-start"] }),
  });

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-start gap-3">
          {scope === "archived" && (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label={t("maintenanceRequests.backToRequests")}
              title={t("maintenanceRequests.back")}
              onClick={() => window.history.length > 1 ? window.history.back() : navigate("/maintenance-requests")}
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
          )}
          <div>
          <h1 className="text-3xl font-bold tracking-tight">{titleForScope(scope, t)}</h1>
          <p className="text-muted-foreground">FORM-10-0975 {t("maintenanceRequests.title").toLowerCase()}.</p>
          </div>
        </div>
        <div className="flex gap-2">
          {hasPermission("manage_maintenance_requests") && (
            <Button variant="outline" asChild>
              <Link href="/maintenance-requests/closed-log"><BookOpen className="me-2 h-4 w-4" />{t("maintenanceRequests.closedLog")}</Link>
            </Button>
          )}
          {hasPermission("archive_maintenance_requests") && scope !== "archived" && (
            <Button variant="outline" asChild>
              <Link href="/maintenance-requests/archive"><Archive className="me-2 h-4 w-4" />{t("maintenanceRequests.archive")}</Link>
            </Button>
          )}
          {hasPermission("submit_maintenance_request") && (
            <Button asChild>
              <Link href="/maintenance-requests/new">
                <Plus className="me-2 h-4 w-4" />
                {t("maintenanceRequests.submitRequest")}
              </Link>
            </Button>
          )}
        </div>
      </div>

      {canSetNumberingStart && (
        <Card>
          <CardContent className="flex flex-wrap items-end gap-3 p-4" dir="rtl">
            <div className="space-y-1">
              <label className="text-sm font-medium">رقم طلب الصيانة</label>
              <Input dir="ltr" inputMode="numeric" value={numberingStart} onChange={(event) => setNumberingStart(event.target.value)} placeholder="400" className="w-40" />
            </div>
            <Button type="button" onClick={() => saveNumberingStart.mutate()} disabled={!numberingStart.trim() || saveNumberingStart.isPending}>
              <Save className="ms-2 h-4 w-4" />حفظ
            </Button>
            {numberingSetting?.nextNumber && <div className="rounded-md border bg-primary/5 px-4 py-2 text-sm"><span className="text-muted-foreground">الرقم التالي تلقائياً: </span><strong dir="ltr" className="font-mono text-base">{numberingSetting.nextNumber}</strong></div>}
            <p className="pb-2 text-sm text-muted-foreground">أدخل آخر رقم ورقي مستخدم؛ مثلاً 400 يجعل أول طلب معتمد في التطبيق 401/MM/YYYY.</p>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("maintenanceRequests.col.requestNo")}</TableHead>
                <TableHead>{t("maintenanceRequests.col.machine")}</TableHead>
                <TableHead>{t("maintenanceRequests.col.department")}</TableHead>
                <TableHead>{t("maintenanceRequests.col.priority")}</TableHead>
                <TableHead>{t("maintenanceRequests.col.date")}</TableHead>
                <TableHead>{t("maintenanceRequests.col.status")}</TableHead>
                <TableHead className="text-end">{t("maintenanceRequests.col.actions")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={7} className="h-24 text-center text-muted-foreground">
                    {t("maintenanceRequests.loading")}
                  </TableCell>
                </TableRow>
              ) : data.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="h-24 text-center text-muted-foreground">
                    {t("maintenanceRequests.empty")}
                  </TableCell>
                </TableRow>
              ) : (
                data.map((request) => (
                  <TableRow key={request.id}>
                    <TableCell className="font-mono">{request.requestReportNumber}</TableCell>
                    <TableCell>
                      <div className="font-medium">{request.machineName}</div>
                      <div className="text-xs text-muted-foreground">{request.machineNumber}</div>
                    </TableCell>
                    <TableCell>{request.departmentSection || "-"}</TableCell>
                    <TableCell>
                      {request.priority === "urgent"
                        ? <Badge variant="destructive">{t("maintenanceRequests.priority.urgent")}</Badge>
                        : <Badge variant="outline">{t("maintenanceRequests.priority.normal")}</Badge>}
                    </TableCell>
                    <TableCell>{request.requestDate}</TableCell>
                    <TableCell><StatusBadge status={request.status} /></TableCell>
                    <TableCell className="text-end">
                      <Button asChild variant="ghost" size="sm">
                        <Link href={`/maintenance-requests/${request.id}`}>{t("maintenanceRequests.open")}</Link>
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
