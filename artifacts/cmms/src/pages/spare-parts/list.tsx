import { Link } from "wouter";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Search } from "lucide-react";
import type { SparePart } from "./types";

export default function SparePartsListPage() {
  const { hasPermission } = useAuth();
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("");

  const searchParams = useMemo(() => {
    const params = new URLSearchParams();
    if (query.trim()) params.set("q", query.trim());
    if (category.trim()) params.set("category", category.trim());
    return params.toString();
  }, [query, category]);

  const { data = [], isLoading } = useQuery({
    queryKey: ["spare-parts", searchParams],
    queryFn: () => apiRequest<SparePart[]>(`/spare-parts${searchParams ? `?${searchParams}` : ""}`),
  });

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Spare Parts</h1>
          <p className="text-muted-foreground">Stock catalogue with append-only movement history.</p>
        </div>
        {hasPermission("manage_spare_parts") && (
          <Button asChild>
            <Link href="/spare-parts/new">
              <Plus className="mr-2 h-4 w-4" />
              Add Spare Part
            </Link>
          </Button>
        )}
      </div>

      <Card>
        <CardContent className="p-4 grid gap-3 md:grid-cols-[1fr_240px]">
          <div className="relative">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input className="pl-9" placeholder="Search part name or code" value={query} onChange={(event) => setQuery(event.target.value)} />
          </div>
          <Input placeholder="Category filter" value={category} onChange={(event) => setCategory(event.target.value)} />
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Part</TableHead>
                <TableHead>Code</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Location</TableHead>
                <TableHead>Current Quantity</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={7} className="h-24 text-center text-muted-foreground">Loading spare parts...</TableCell></TableRow>
              ) : data.length === 0 ? (
                <TableRow><TableCell colSpan={7} className="h-24 text-center text-muted-foreground">No spare parts found.</TableCell></TableRow>
              ) : (
                data.map((part) => (
                  <TableRow key={part.id}>
                    <TableCell className="font-medium">{part.partName}</TableCell>
                    <TableCell className="font-mono">{part.partCode}</TableCell>
                    <TableCell>{part.category || "-"}</TableCell>
                    <TableCell>{part.location || "-"}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <span>{part.currentQuantity} {part.unit}</span>
                        {part.isLowStock && <Badge variant="destructive">Low stock</Badge>}
                      </div>
                    </TableCell>
                    <TableCell><Badge variant={part.status === "active" ? "secondary" : "outline"}>{part.status}</Badge></TableCell>
                    <TableCell className="text-right">
                      <Button asChild variant="ghost" size="sm">
                        <Link href={`/spare-parts/${part.id}`}>Open</Link>
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
