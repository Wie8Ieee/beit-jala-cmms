import { FormEvent, useEffect, useState } from "react";
import { Link, useLocation } from "wouter";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeft, Save } from "lucide-react";
import type { SparePart } from "./types";

export default function SparePartFormPage({ params }: { params?: { id?: string } }) {
  const id = params?.id ? Number(params.id) : null;
  const [, setLocation] = useLocation();
  const [partName, setPartName] = useState("");
  const [partCode, setPartCode] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("");
  const [unit, setUnit] = useState("piece");
  const [minimumQuantity, setMinimumQuantity] = useState("0");
  const [location, setPartLocation] = useState("");
  const [status, setStatus] = useState("active");

  const { data } = useQuery({
    queryKey: ["spare-part", id],
    queryFn: () => apiRequest<SparePart>(`/spare-parts/${id}`),
    enabled: !!id,
  });

  useEffect(() => {
    if (!data) return;
    setPartName(data.partName);
    setPartCode(data.partCode);
    setDescription(data.description ?? "");
    setCategory(data.category ?? "");
    setUnit(data.unit);
    setMinimumQuantity(String(data.minimumQuantity));
    setPartLocation(data.location ?? "");
    setStatus(data.status);
  }, [data]);

  const save = useMutation({
    mutationFn: () =>
      apiRequest<SparePart>(id ? `/spare-parts/${id}` : "/spare-parts", {
        method: id ? "PUT" : "POST",
        body: JSON.stringify({
          partName,
          partCode,
          description,
          category,
          unit,
          minimumQuantity: Number(minimumQuantity),
          location,
          status,
        }),
      }),
    onSuccess: (part) => setLocation(`/spare-parts/${part.id}`),
  });

  function submit(event: FormEvent) {
    event.preventDefault();
    save.mutate();
  }

  return (
    <form onSubmit={submit} className="space-y-6 max-w-4xl mx-auto">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" asChild>
          <Link href={id ? `/spare-parts/${id}` : "/spare-parts"}>
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{id ? "Edit Spare Part" : "Add Spare Part"}</h1>
          <p className="text-muted-foreground">Catalogue fields for stock management.</p>
        </div>
      </div>

      <Card>
        <CardHeader><CardTitle>Part Information</CardTitle></CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div><Label>Part name</Label><Input required value={partName} onChange={(event) => setPartName(event.target.value)} /></div>
          <div><Label>Part code</Label><Input required value={partCode} onChange={(event) => setPartCode(event.target.value)} /></div>
          <div><Label>Category</Label><Input value={category} onChange={(event) => setCategory(event.target.value)} /></div>
          <div><Label>Unit</Label><Input value={unit} onChange={(event) => setUnit(event.target.value)} /></div>
          <div><Label>Minimum quantity</Label><Input type="number" min="0" value={minimumQuantity} onChange={(event) => setMinimumQuantity(event.target.value)} /></div>
          <div><Label>Location</Label><Input value={location} onChange={(event) => setPartLocation(event.target.value)} /></div>
          <div><Label>Status</Label><Input value={status} onChange={(event) => setStatus(event.target.value)} /></div>
          <div className="md:col-span-2"><Label>Description</Label><Textarea value={description} onChange={(event) => setDescription(event.target.value)} /></div>
          <Button type="submit" disabled={save.isPending} className="w-fit">
            <Save className="mr-2 h-4 w-4" />
            Save Spare Part
          </Button>
        </CardContent>
      </Card>
    </form>
  );
}
