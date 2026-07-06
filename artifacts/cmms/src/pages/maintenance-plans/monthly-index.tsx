import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

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

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Monthly PM Program</h1>
          <p className="text-muted-foreground">Select a month for FORM-10-0117.</p>
        </div>
        <Button asChild variant="outline">
          <Link href="/maintenance-plans">Back</Link>
        </Button>
      </div>

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
