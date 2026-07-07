import { Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";

export function PrintButton() {
  const { hasPermission } = useAuth();
  if (!hasPermission("print_forms")) return null;

  return (
    <Button type="button" variant="outline" onClick={() => window.print()} className="print:hidden">
      <Printer className="mr-2 h-4 w-4" />
      Print
    </Button>
  );
}
