import { Link } from "wouter";
import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowLeft, Save } from "lucide-react";

const months = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

export default function MonthlyPlansIndexPage({ params }: { params: { year: string } }) {
  const year = Number(params.year);
  const { hasPermission } = useAuth();
  const queryClient = useQueryClient();
  const [header, setHeader] = useState<{ companyName: string; documentName: string; documentNumber: string; effectiveOrExecutionDate: string | null }>({ companyName: "", documentName: "", documentNumber: "", effectiveOrExecutionDate: "" });
  const { data: savedHeader } = useQuery({ queryKey: ["monthly-pm-header"], queryFn: () => apiRequest<typeof header>("/maintenance-plans/monthly/header") });
  useEffect(() => { if (savedHeader) setHeader(savedHeader); }, [savedHeader]);
  const saveHeader = useMutation({ mutationFn: () => apiRequest("/maintenance-plans/monthly/header", { method: "PUT", body: JSON.stringify(header) }), onSuccess: () => queryClient.invalidateQueries({ queryKey: ["monthly-pm-header"] }) });

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div className="flex items-start gap-3">
        <Button asChild variant="ghost" size="icon" className="mt-1" aria-label="Back">
          <Link href="/maintenance-plans"><ArrowLeft className="h-5 w-5" /></Link>
        </Button>
        <div>
          <h1 className="text-4xl font-bold tracking-tight">Monthly PM Program</h1>
          <p className="text-muted-foreground">Select a month for FORM-10-0117.</p>
        </div>
      </div>

      {hasPermission("edit_header") && <Card>
        <CardHeader><CardTitle>Monthly Plan Header Settings</CardTitle></CardHeader>
        <CardContent className="grid max-w-2xl gap-4 md:grid-cols-2">
          <div><Label>Document number</Label><Input value={header.documentNumber} onChange={(event) => setHeader({ ...header, documentNumber: event.target.value })} /></div>
          <div><Label>Effective date</Label><Input value={header.effectiveOrExecutionDate ?? ""} onChange={(event) => setHeader({ ...header, effectiveOrExecutionDate: event.target.value })} /></div>
          <div className="md:col-span-2"><Button type="button" onClick={() => saveHeader.mutate()} disabled={saveHeader.isPending}><Save className="mr-2 h-4 w-4" />Save Header for All Months</Button></div>
        </CardContent>
      </Card>}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {months.map((month, index) => (
          <Card key={month}>
            <CardContent className="p-4 flex items-center justify-between">
              <span className="font-medium">{month} {year}</span>
              <Button asChild size="sm">
                <Link href={`/maintenance-plans/monthly/${year}/${index + 1}`}>Open</Link>
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
