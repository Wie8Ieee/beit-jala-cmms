import { FormEvent, useState } from "react";
import { Link } from "wouter";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ArrowLeft, Plus, Trash2 } from "lucide-react";

type Point = {
  id: number;
  pointText: string;
  resultType: "yes_no" | "value" | "text";
  sortOrder: number;
  isActive: boolean;
};

export default function PmChecklistPage({ params }: { params: { id: string } }) {
  const machineId = Number(params.id);
  const queryClient = useQueryClient();
  const [pointText, setPointText] = useState("");
  const [resultType, setResultType] = useState<"yes_no" | "value" | "text">("yes_no");
  const [sortOrder, setSortOrder] = useState(1);

  const { data = [] } = useQuery({
    queryKey: ["pm-checklist", machineId],
    queryFn: () => apiRequest<Point[]>(`/machines/${machineId}/pm/checklist`),
  });

  const createPoint = useMutation({
    mutationFn: () =>
      apiRequest<Point>(`/machines/${machineId}/pm/checklist`, {
        method: "POST",
        body: JSON.stringify({ pointText, resultType, sortOrder }),
      }),
    onSuccess: () => {
      setPointText("");
      setSortOrder((value) => value + 1);
      queryClient.invalidateQueries({ queryKey: ["pm-checklist", machineId] });
    },
  });

  const deactivatePoint = useMutation({
    mutationFn: (pointId: number) =>
      apiRequest<Point>(`/machines/${machineId}/pm/checklist/${pointId}`, { method: "PATCH" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["pm-checklist", machineId] }),
  });

  function submit(event: FormEvent) {
    event.preventDefault();
    createPoint.mutate();
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" asChild>
          <Link href={`/machines/${machineId}/pm`}>
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Manage Checklist Points</h1>
          <p className="text-muted-foreground">Inactive points are preserved for historical PM records.</p>
        </div>
      </div>

      <form onSubmit={submit}>
        <Card>
          <CardHeader>
            <CardTitle>Add Checklist Point</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-[1fr_180px_120px_auto] md:items-end">
            <div>
              <Label>Checklist point</Label>
              <Input value={pointText} onChange={(event) => setPointText(event.target.value)} required />
            </div>
            <div>
              <Label>Result type</Label>
              <Select value={resultType} onValueChange={(value) => setResultType(value as typeof resultType)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="yes_no">Yes / No</SelectItem>
                  <SelectItem value="value">Numeric / Value</SelectItem>
                  <SelectItem value="text">Text</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Order</Label>
              <Input type="number" value={sortOrder} onChange={(event) => setSortOrder(Number(event.target.value))} />
            </div>
            <Button type="submit" disabled={createPoint.isPending || !pointText.trim()}>
              <Plus className="mr-2 h-4 w-4" />
              Add
            </Button>
          </CardContent>
        </Card>
      </form>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Order</TableHead>
                <TableHead>Checklist Point</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map((point) => (
                <TableRow key={point.id}>
                  <TableCell>{point.sortOrder}</TableCell>
                  <TableCell>{point.pointText}</TableCell>
                  <TableCell>{point.resultType}</TableCell>
                  <TableCell>{point.isActive ? "Active" : "Inactive"}</TableCell>
                  <TableCell className="text-right">
                    {point.isActive && (
                      <Button variant="ghost" size="icon" onClick={() => deactivatePoint.mutate(point.id)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
