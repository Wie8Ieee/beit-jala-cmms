import { Link, useLocation } from "wouter";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ArrowLeft, Edit, Minus, Plus, SlidersHorizontal, Trash2 } from "lucide-react";
import type { SparePart, SparePartMovement } from "./types";

export default function SparePartDetailPage({ params }: { params: { id: string } }) {
  const id = Number(params.id);
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const { hasPermission } = useAuth();
  const canManage = hasPermission("manage_spare_parts");
  const canRecordUsage = canManage || hasPermission("record_spare_part_usage");

  const { data: part } = useQuery({
    queryKey: ["spare-part", id],
    queryFn: () => apiRequest<SparePart>(`/spare-parts/${id}`),
  });
  const { data: movements = [] } = useQuery({
    queryKey: ["spare-part-movements", id],
    queryFn: () => apiRequest<SparePartMovement[]>(`/spare-parts/${id}/movements`),
  });

  const softDelete = useMutation({
    mutationFn: () => apiRequest<SparePart>(`/spare-parts/${id}/soft-delete`, { method: "PATCH" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["spare-parts"] });
      setLocation("/spare-parts");
    },
  });

  if (!part) return <div className="p-8 text-muted-foreground">Loading spare part...</div>;

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/spare-parts">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div className="flex-1">
          <h1 className="text-3xl font-bold tracking-tight">{part.partName}</h1>
          <p className="text-muted-foreground font-mono">{part.partCode}</p>
        </div>
        {part.isLowStock && <Badge variant="destructive">Low stock</Badge>}
      </div>

      <Card>
        <CardHeader><CardTitle>Part Record</CardTitle></CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-4">
          <div><div className="text-sm text-muted-foreground">Current quantity</div><div className="text-2xl font-semibold">{part.currentQuantity} {part.unit}</div></div>
          <div><div className="text-sm text-muted-foreground">Minimum quantity</div><div className="text-lg font-medium">{part.minimumQuantity} {part.unit}</div></div>
          <div><div className="text-sm text-muted-foreground">Category</div><div className="font-medium">{part.category || "-"}</div></div>
          <div><div className="text-sm text-muted-foreground">Location</div><div className="font-medium">{part.location || "-"}</div></div>
          <div className="md:col-span-4 text-sm text-muted-foreground">{part.description || "No description recorded."}</div>
          <div className="md:col-span-4 flex flex-wrap gap-2">
            {canManage && (
              <>
                <Button asChild variant="outline"><Link href={`/spare-parts/${id}/edit`}><Edit className="mr-2 h-4 w-4" />Edit</Link></Button>
                <Button asChild><Link href={`/spare-parts/${id}/movements/new?type=IN`}><Plus className="mr-2 h-4 w-4" />Stock In</Link></Button>
                <Button asChild variant="outline"><Link href={`/spare-parts/${id}/movements/new?type=ADJUSTMENT`}><SlidersHorizontal className="mr-2 h-4 w-4" />Adjustment</Link></Button>
              </>
            )}
            {canRecordUsage && <Button asChild variant="outline"><Link href={`/spare-parts/${id}/movements/new?type=OUT`}><Minus className="mr-2 h-4 w-4" />Stock Out</Link></Button>}
            {canManage && <Button variant="destructive" onClick={() => softDelete.mutate()}><Trash2 className="mr-2 h-4 w-4" />Soft Delete</Button>}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Stock Movement History</CardTitle></CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Quantity</TableHead>
                <TableHead>Before</TableHead>
                <TableHead>After</TableHead>
                <TableHead>Reference</TableHead>
                <TableHead>Reason</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {movements.length === 0 ? (
                <TableRow><TableCell colSpan={7} className="h-24 text-center text-muted-foreground">No stock movements recorded.</TableCell></TableRow>
              ) : (
                movements.map((movement) => (
                  <TableRow key={movement.id}>
                    <TableCell>{movement.movementDate}</TableCell>
                    <TableCell><Badge variant="secondary">{movement.movementType}</Badge></TableCell>
                    <TableCell>{movement.quantity}</TableCell>
                    <TableCell>{movement.quantityBefore}</TableCell>
                    <TableCell>{movement.quantityAfter}</TableCell>
                    <TableCell>{movement.referenceType}{movement.referenceId ? ` #${movement.referenceId}` : ""}</TableCell>
                    <TableCell>{movement.reason || movement.notes || "-"}</TableCell>
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
