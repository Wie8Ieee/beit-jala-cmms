import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/api";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

type AuditLog = {
  id: number;
  userName: string | null;
  username: string | null;
  action: string;
  entityType: string | null;
  entityId: number | null;
  details: unknown;
  oldValue: unknown;
  newValue: unknown;
  createdAt: string;
};

function readable(value: unknown) {
  if (value === null || value === undefined) return "-";
  return typeof value === "string" ? value : JSON.stringify(value);
}

export default function AuditLogsPage() {
  const { data = [], isLoading } = useQuery({
    queryKey: ["audit-logs"],
    queryFn: () => apiRequest<AuditLog[]>("/audit-logs"),
  });

  return <div className="mx-auto max-w-7xl space-y-6">
    <div>
      <h1 className="text-3xl font-bold tracking-tight">Audit Log</h1>
      <p className="text-muted-foreground">The latest 500 recorded system activities.</p>
    </div>
    <Card><CardContent className="overflow-x-auto p-0">
      <Table dir="ltr">
        <TableHeader><TableRow>
          <TableHead>Date and time</TableHead>
          <TableHead>User</TableHead>
          <TableHead>Action</TableHead>
          <TableHead>Entity type</TableHead>
          <TableHead>Entity ID</TableHead>
          <TableHead>Details</TableHead>
        </TableRow></TableHeader>
        <TableBody>
          {isLoading ? <TableRow><TableCell colSpan={6} className="h-24 text-center">Loading...</TableCell></TableRow>
            : data.length === 0 ? <TableRow><TableCell colSpan={6} className="h-24 text-center text-muted-foreground">No activities have been recorded.</TableCell></TableRow>
            : data.map((row) => <TableRow key={row.id}>
              <TableCell className="whitespace-nowrap">{new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "medium" }).format(new Date(row.createdAt))}</TableCell>
              <TableCell>{row.userName || row.username || "System"}</TableCell>
              <TableCell className="font-medium">{row.action.replaceAll("_", " ")}</TableCell>
              <TableCell>{row.entityType?.replaceAll("_", " ") || "-"}</TableCell>
              <TableCell>{row.entityId ?? "-"}</TableCell>
              <TableCell className="max-w-md break-words text-xs">{readable(row.details ?? row.newValue ?? row.oldValue)}</TableCell>
            </TableRow>)}
        </TableBody>
      </Table>
    </CardContent></Card>
  </div>;
}
