import { useState } from "react";
import { Link } from "wouter";
import { getGetMachinesQueryKey, useGetMachines } from "@workspace/api-client-react";
import { useAuth } from "@/contexts/AuthContext";
import { useTranslation } from "react-i18next";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Search, Plus, Server, AlertCircle, Archive, List } from "lucide-react";
import { useDebounce } from "@/hooks/use-debounce";
import { Skeleton } from "@/components/ui/skeleton";

export default function MachinesList() {
  const { t, i18n } = useTranslation();
  const isArabic = i18n.language.startsWith("ar");
  const [searchTerm, setSearchTerm] = useState("");
  const [showArchived, setShowArchived] = useState(false);
  const debouncedSearch = useDebounce(searchTerm, 300);
  const { hasPermission } = useAuth();
  
  const machineParams = debouncedSearch || showArchived
    ? { ...(debouncedSearch ? { search: debouncedSearch } : {}), ...(showArchived ? { archived: true } : {}) }
    : undefined;
  const { data: machines, isLoading, isError } = useGetMachines(machineParams, {
    query: {
      queryKey: getGetMachinesQueryKey(machineParams),
      enabled: true
    },
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "Active":
        return <Badge className="bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20 border-emerald-500/20">Active</Badge>;
      case "Maintenance":
        return <Badge className="bg-amber-500/10 text-amber-600 hover:bg-amber-500/20 border-amber-500/20">Maintenance</Badge>;
      case "Inactive":
        return <Badge variant="secondary" className="text-muted-foreground">Inactive</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{t('machines.title')}</h1>
          <p className="text-muted-foreground">{t('machines.subtitle')}</p>
        </div>
        
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setShowArchived((current) => !current)}>
            {showArchived ? <List className="mr-2 h-4 w-4" /> : <Archive className="mr-2 h-4 w-4" />}
            {showArchived ? "Active Machines" : "Archived Machines"}
          </Button>
          {hasPermission("create_machine") && (
            <Button asChild>
              <Link href="/machines/new">
                <Plus className="mr-2 h-4 w-4" />
                {t('machines.addNew')}
              </Link>
            </Button>
          )}
        </div>
      </div>

      <div className="flex items-center space-x-2 bg-card p-4 rounded-lg border shadow-sm">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            type="search"
            placeholder={t('machines.searchPlaceholder')}
            className="pl-9 bg-background"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      <div className="bg-card rounded-lg border shadow-sm overflow-hidden">
        <Table dir={isArabic ? "rtl" : "ltr"} className="w-full table-fixed">
          <colgroup>
            <col className="w-[14%]" />
            <col className="w-[22%]" />
            <col className="w-[20%]" />
            <col className="w-[18%]" />
            <col className="w-[12%]" />
            <col className="w-[14%]" />
          </colgroup>
          <TableHeader>
            <TableRow className="bg-muted/50">
              <TableHead className="text-center">{t('machines.idNumber')}</TableHead>
              <TableHead className="text-center">{t('machines.machineName')}</TableHead>
              <TableHead className="text-center">{t('machines.department')}</TableHead>
              <TableHead className="text-center">{t('machines.location')}</TableHead>
              <TableHead className="text-center">{t('machines.status')}</TableHead>
              <TableHead className="text-center">{t('common.actions')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell className="text-center"><Skeleton className="mx-auto h-4 w-16" /></TableCell>
                  <TableCell className="text-center"><Skeleton className="mx-auto h-4 w-48" /></TableCell>
                  <TableCell className="text-center"><Skeleton className="mx-auto h-4 w-32" /></TableCell>
                  <TableCell className="text-center"><Skeleton className="mx-auto h-4 w-24" /></TableCell>
                  <TableCell className="text-center"><Skeleton className="mx-auto h-6 w-20 rounded-full" /></TableCell>
                  <TableCell className="text-center"><Skeleton className="mx-auto h-8 w-16" /></TableCell>
                </TableRow>
              ))
            ) : isError ? (
              <TableRow>
                <TableCell colSpan={6} className="h-32 text-center">
                  <div className="flex flex-col items-center justify-center text-destructive">
                    <AlertCircle className="h-8 w-8 mb-2" />
                    <p>{t('machines.failedToLoad')}</p>
                  </div>
                </TableCell>
              </TableRow>
            ) : machines?.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="h-48 text-center">
                  <div className="flex flex-col items-center justify-center text-muted-foreground">
                    <Server className="h-10 w-10 mb-3 opacity-20" />
                    <p className="text-lg font-medium text-foreground">{t('machines.noMachines')}</p>
                    <p className="text-sm">{t('machines.adjustSearch')}</p>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              machines?.map((machine) => (
                <TableRow key={machine.id} className="group hover:bg-muted/30 transition-colors">
                  <TableCell className="font-mono text-center text-sm">{machine.machineNumber}</TableCell>
                  <TableCell className="break-words text-center font-medium text-primary">{machine.machineName}</TableCell>
                  <TableCell className="break-words text-center">{machine.departmentName || t('common_extra.unassigned')}</TableCell>
                  <TableCell className="break-words text-center text-muted-foreground">{machine.location || "—"}</TableCell>
                  <TableCell className="text-center">{machine.deletedAt ? <Badge variant="secondary">Archived</Badge> : getStatusBadge(machine.status)}</TableCell>
                  <TableCell className="text-center">
                    <Button variant="ghost" size="sm" asChild className="opacity-0 group-hover:opacity-100 transition-opacity">
                      <Link href={`/machines/${machine.id}`}>{t('machines.viewProfile')}</Link>
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
