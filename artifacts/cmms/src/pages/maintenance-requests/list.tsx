import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { apiRequest } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus } from "lucide-react";
import type { MaintenanceRequestSummary } from "./types";

function titleForScope(scope: string, t: (k: string) => string) {
  if (scope === "own") return t("maintenanceRequests.myRequests");
  if (scope === "qa") return t("maintenanceRequests.qaQueue");
  if (scope === "engineering") return t("maintenanceRequests.engineeringQueue");
  if (scope === "technician") return t("maintenanceRequests.technicianQueue");
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
  const { data = [], isLoading } = useQuery({
    queryKey: ["maintenance-requests", scope],
    queryFn: () => apiRequest<MaintenanceRequestSummary[]>(`/maintenance-requests?scope=${scope}`),
  });

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{titleForScope(scope, t)}</h1>
          <p className="text-muted-foreground">FORM-10-0975 {t("maintenanceRequests.title").toLowerCase()}.</p>
        </div>
        {hasPermission("submit_maintenance_request") && (
          <Button asChild>
            <Link href="/maintenance-requests/new">
              <Plus className="me-2 h-4 w-4" />
              {t("maintenanceRequests.submitRequest")}
            </Link>
          </Button>
        )}
      </div>

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
