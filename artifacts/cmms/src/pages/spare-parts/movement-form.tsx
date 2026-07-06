import { FormEvent, useEffect, useMemo, useState } from "react";
import { Link, useLocation } from "wouter";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeft, Save } from "lucide-react";
import type { SparePart, SparePartMovement } from "./types";

export default function SparePartMovementFormPage({ params }: { params: { id: string } }) {
  const id = Number(params.id);
  const [, setLocation] = useLocation();
  const { hasPermission } = useAuth();
  const initialType = useMemo(() => new URLSearchParams(window.location.search).get("type") || "OUT", []);
  const [movementType, setMovementType] = useState(initialType);
  const [quantity, setQuantity] = useState("1");
  const [movementDate, setMovementDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [reason, setReason] = useState("");
  const [referenceType, setReferenceType] = useState("MANUAL");
  const [referenceId, setReferenceId] = useState("");
  const [notes, setNotes] = useState("");

  const { data: part } = useQuery({
    queryKey: ["spare-part", id],
    queryFn: () => apiRequest<SparePart>(`/spare-parts/${id}`),
  });

  useEffect(() => {
    if (!hasPermission("manage_spare_parts") && movementType !== "OUT") {
      setMovementType("OUT");
    }
  }, [hasPermission, movementType]);

  const save = useMutation({
    mutationFn: () =>
      apiRequest<SparePartMovement>(`/spare-parts/${id}/movements`, {
        method: "POST",
        body: JSON.stringify({
          movementType,
          quantity: Number(quantity),
          movementDate,
          reason,
          referenceType,
          referenceId: referenceId ? Number(referenceId) : null,
          notes,
        }),
      }),
    onSuccess: () => setLocation(`/spare-parts/${id}`),
  });

  function submit(event: FormEvent) {
    event.preventDefault();
    save.mutate();
  }

  return (
    <form onSubmit={submit} className="space-y-6 max-w-4xl mx-auto">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" asChild>
          <Link href={`/spare-parts/${id}`}>
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Record Stock Movement</h1>
          <p className="text-muted-foreground">{part ? `${part.partName} (${part.partCode})` : "Loading spare part..."}</p>
        </div>
      </div>

      <Card>
        <CardHeader><CardTitle>Movement Details</CardTitle></CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div>
            <Label>Movement type</Label>
            <Select value={movementType} onValueChange={setMovementType}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {hasPermission("manage_spare_parts") && <SelectItem value="IN">Stock In</SelectItem>}
                <SelectItem value="OUT">Stock Out</SelectItem>
                {hasPermission("manage_spare_parts") && <SelectItem value="ADJUSTMENT">Adjustment</SelectItem>}
              </SelectContent>
            </Select>
          </div>
          <div><Label>Quantity</Label><Input type="number" min={movementType === "ADJUSTMENT" ? "0" : "1"} required value={quantity} onChange={(event) => setQuantity(event.target.value)} /></div>
          <div><Label>Date</Label><Input type="date" value={movementDate} onChange={(event) => setMovementDate(event.target.value)} /></div>
          <div><Label>Reason</Label><Input value={reason} onChange={(event) => setReason(event.target.value)} /></div>
          <div>
            <Label>Maintenance reference type</Label>
            <Select value={referenceType} onValueChange={setReferenceType}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="MANUAL">Manual</SelectItem>
                <SelectItem value="PM_RECORD">PM Record</SelectItem>
                <SelectItem value="CM_REQUEST">CM Request</SelectItem>
                <SelectItem value="OTHER">Other</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div><Label>Reference ID</Label><Input type="number" min="1" value={referenceId} onChange={(event) => setReferenceId(event.target.value)} /></div>
          <div className="md:col-span-2"><Label>Notes</Label><Textarea value={notes} onChange={(event) => setNotes(event.target.value)} /></div>
          <Button type="submit" disabled={save.isPending} className="w-fit">
            <Save className="mr-2 h-4 w-4" />
            Record Movement
          </Button>
        </CardContent>
      </Card>
    </form>
  );
}
