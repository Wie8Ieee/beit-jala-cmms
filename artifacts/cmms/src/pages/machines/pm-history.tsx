import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ArrowLeft } from "lucide-react";

type RecordSummary = {
  id: number;
  sequenceNumber: number;
  status: string;
  inspectionCount: number;
  createdAt: string;
  updatedAt: string;
};

export default function PmHistoryPage({ params }: { params: { id: string } }) {
  const machineId = Number(params.id);
  const { data = [] } = useQuery({
    queryKey: ["pm-history", machineId],
    queryFn: () => apiRequest<RecordSummary[]>(`/machines/${machineId}/pm/history`),
  });

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" asChild>
          <Link href={`/machines/${machineId}`}>
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">PM Record History</h1>
          <p className="text-muted-foreground">Records are chained oldest to newest and preserved permanently.</p>
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Record</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Inspections</TableHead>
                <TableHead>Created</TableHead>
                <TableHead>Updated</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map((record) => (
                <TableRow key={record.id}>
                  <TableCell>#{record.sequenceNumber}</TableCell>
                  <TableCell>{record.status}</TableCell>
                  <TableCell>{record.inspectionCount}</TableCell>
                  <TableCell>{new Date(record.createdAt).toLocaleDateString()}</TableCell>
                  <TableCell>{new Date(record.updatedAt).toLocaleDateString()}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
