import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus } from "lucide-react";
import type { MaintenanceRequestSummary } from "./types";

function titleForScope(scope: string) {
  if (scope === "own") return "My Submitted Requests";
  if (scope === "qa") return "Pending QA Approval";
  if (scope === "engineering") return "Engineering Review Queue";
  if (scope === "technician") return "Accepted Corrective Maintenance";
  return "Maintenance Requests";
}

export default function MaintenanceRequestsListPage({ scope = "all" }: { scope?: string }) {
  const { hasPermission } = useAuth();
  const { data = [], isLoading } = useQuery({
    queryKey: ["maintenance-requests", scope],
    queryFn: () => apiRequest<MaintenanceRequestSummary[]>(`/maintenance-requests?scope=${scope}`),
  });

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{titleForScope(scope)}</h1>
          <p className="text-muted-foreground">FORM-10-0975 request workflow and linked corrective maintenance records.</p>
        </div>
        {hasPermission("submit_maintenance_request") && (
          <Button asChild>
            <Link href="/maintenance-requests/new">
              <Plus className="mr-2 h-4 w-4" />
              Submit Request
            </Link>
          </Button>
        )}
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Request / Report No.</TableHead>
                <TableHead>Machine</TableHead>
                <TableHead>Department / Section</TableHead>
                <TableHead>Priority</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={7} className="h-24 text-center text-muted-foreground">Loading requests...</TableCell>
                </TableRow>
              ) : data.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="h-24 text-center text-muted-foreground">No requests found.</TableCell>
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
                    <TableCell>{request.priority === "urgent" ? <Badge variant="destructive">Urgent</Badge> : <Badge variant="outline">Normal</Badge>}</TableCell>
                    <TableCell>{request.requestDate}</TableCell>
                    <TableCell><Badge variant="secondary">{request.status}</Badge></TableCell>
                    <TableCell className="text-right">
                      <Button asChild variant="ghost" size="sm">
                        <Link href={`/maintenance-requests/${request.id}`}>Open</Link>
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
