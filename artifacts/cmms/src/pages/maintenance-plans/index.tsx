import { Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CalendarDays, Table2 } from "lucide-react";

export default function MaintenancePlansPage() {
  const year = new Date().getFullYear();

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Maintenance Plans</h1>
        <p className="text-muted-foreground">Annual and Monthly Preventive Maintenance official forms.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Table2 className="h-5 w-5 text-primary" />
              Annual Plan
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">FORM-10-1025 schedule generated from machine PM start date and frequency.</p>
            <Button asChild>
              <Link href={`/maintenance-plans/annual/${year}`}>Open {year} Annual Plan</Link>
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CalendarDays className="h-5 w-5 text-primary" />
              Monthly Plan
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">FORM-10-0117 monthly program derived from the Annual Plan.</p>
            <Button asChild variant="outline">
              <Link href={`/maintenance-plans/monthly/${year}`}>Select Month</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
