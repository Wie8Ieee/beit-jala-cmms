import { useState, useEffect } from "react";
import { Link } from "wouter";
import { useAuth } from "../../contexts/AuthContext";
import { 
  useGetMachine,
  useGetEquipmentInformation,
  useUpsertEquipmentInformation,
  getGetMachineQueryKey,
  getGetEquipmentInformationQueryKey
} from "@workspace/api-client-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";

import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { ArrowLeft, Printer, Save, FileText, Loader2, AlertCircle } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

const equipmentInfoSchema = z.object({
  nameOfEquipment: z.string().optional(),
  modelNumber: z.string().optional(),
  serialNumber: z.string().optional(),
  identificationNumber: z.string().optional(),
  datePurchased: z.string().optional(),
  
  purchasedFromName: z.string().optional(),
  purchasedFromAddress: z.string().optional(),
  
  manufacturingCompanyName: z.string().optional(),
  manufacturingCompanyAddress: z.string().optional(),
  
  dimensionWidthCm: z.coerce.number().optional().nullable(),
  dimensionHeightCm: z.coerce.number().optional().nullable(),
  dimensionDepthCm: z.coerce.number().optional().nullable(),
  weightKg: z.coerce.number().optional().nullable(),
  
  utilitiesPowerSupply: z.string().optional(),
  utilitiesAir: z.string().optional(),
  utilitiesWater: z.string().optional(),
  utilitiesOther: z.string().optional(),
  
  others: z.string().optional(),
  safetyIssues: z.string().optional(),
  
  preparedByName: z.string().optional(),
  preparedByDate: z.string().optional(),
  approvedByName: z.string().optional(),
  approvedByDate: z.string().optional(),
});

type EquipmentInfoValues = z.infer<typeof equipmentInfoSchema>;

export default function EquipmentInformationForm({ params }: { params: { id: string } }) {
  const machineId = parseInt(params.id, 10);
  const { hasPermission } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const canEdit = hasPermission("edit_equipment_information");

  const { data: machine, isLoading: isLoadingMachine } = useGetMachine(machineId, {
    query: { enabled: !!machineId, queryKey: getGetMachineQueryKey(machineId) }
  });

  const { data: equipInfo, isLoading: isLoadingInfo } = useGetEquipmentInformation(machineId, {
    query: { enabled: !!machineId, queryKey: getGetEquipmentInformationQueryKey(machineId) }
  });

  const upsertMutation = useUpsertEquipmentInformation();

  const form = useForm<EquipmentInfoValues>({
    resolver: zodResolver(equipmentInfoSchema),
    defaultValues: {},
  });

  useEffect(() => {
    if (equipInfo) {
      form.reset({
        nameOfEquipment: equipInfo.nameOfEquipment || "",
        modelNumber: equipInfo.modelNumber || "",
        serialNumber: equipInfo.serialNumber || "",
        identificationNumber: equipInfo.identificationNumber || machine?.machineNumber || "",
        datePurchased: equipInfo.datePurchased ? equipInfo.datePurchased.split('T')[0] : "",
        
        purchasedFromName: equipInfo.purchasedFromName || "",
        purchasedFromAddress: equipInfo.purchasedFromAddress || "",
        
        manufacturingCompanyName: equipInfo.manufacturingCompanyName || "",
        manufacturingCompanyAddress: equipInfo.manufacturingCompanyAddress || "",
        
        dimensionWidthCm: equipInfo.dimensionWidthCm,
        dimensionHeightCm: equipInfo.dimensionHeightCm,
        dimensionDepthCm: equipInfo.dimensionDepthCm,
        weightKg: equipInfo.weightKg,
        
        utilitiesPowerSupply: equipInfo.utilitiesPowerSupply || "",
        utilitiesAir: equipInfo.utilitiesAir || "",
        utilitiesWater: equipInfo.utilitiesWater || "",
        utilitiesOther: equipInfo.utilitiesOther || "",
        
        others: equipInfo.others || "",
        safetyIssues: equipInfo.safetyIssues || "",
        
        preparedByName: equipInfo.preparedByName || "",
        preparedByDate: equipInfo.preparedByDate ? equipInfo.preparedByDate.split('T')[0] : "",
        approvedByName: equipInfo.approvedByName || "",
        approvedByDate: equipInfo.approvedByDate ? equipInfo.approvedByDate.split('T')[0] : "",
      });
    } else if (machine) {
      form.reset({
        nameOfEquipment: machine.machineName,
        identificationNumber: machine.machineNumber,
      });
    }
  }, [equipInfo, machine, form]);

  const onSubmit = (values: EquipmentInfoValues) => {
    // Nullify empty numeric fields
    const payload = {
      ...values,
      dimensionWidthCm: values.dimensionWidthCm || null,
      dimensionHeightCm: values.dimensionHeightCm || null,
      dimensionDepthCm: values.dimensionDepthCm || null,
      weightKg: values.weightKg || null,
    };

    upsertMutation.mutate(
      { id: machineId, data: payload },
      {
        onSuccess: (data) => {
          queryClient.invalidateQueries({ queryKey: getGetEquipmentInformationQueryKey(machineId) });
          toast({
            title: "Record Saved",
            description: "Equipment Information Record updated successfully.",
          });
        },
        onError: (error) => {
          toast({
            variant: "destructive",
            title: "Save Failed",
            description: (error.data as { error?: string })?.error || "An unexpected error occurred while saving.",
          });
        }
      }
    );
  };

  const isLoading = isLoadingMachine || isLoadingInfo;

  if (isLoading) {
    return (
      <div className="space-y-6 max-w-5xl mx-auto">
        <Skeleton className="h-12 w-64" />
        <div className="bg-card border shadow-sm p-8 rounded-lg space-y-8">
           <Skeleton className="h-8 w-1/3 mx-auto" />
           <Skeleton className="h-32 w-full" />
           <Skeleton className="h-32 w-full" />
           <Skeleton className="h-32 w-full" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto animate-in fade-in duration-500">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild className="rounded-full">
            <Link href={`/machines/${machineId}`}>
              <ArrowLeft className="h-5 w-5" />
            </Link>
          </Button>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Equipment Information</h1>
            <p className="text-muted-foreground">FORM-10-0118</p>
          </div>
        </div>

        <div className="flex gap-2">
          <Tooltip>
            <TooltipTrigger asChild>
              <span tabIndex={0}>
                <Button variant="outline" disabled>
                  <Printer className="mr-2 h-4 w-4" />
                  Print
                </Button>
              </span>
            </TooltipTrigger>
            <TooltipContent>Coming in a later phase</TooltipContent>
          </Tooltip>

          {canEdit && (
            <Button 
              onClick={form.handleSubmit(onSubmit)} 
              disabled={upsertMutation.isPending}
            >
              {upsertMutation.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Save className="mr-2 h-4 w-4" />
              )}
              Save Form
            </Button>
          )}
        </div>
      </div>

      {!canEdit && (
        <div className="bg-amber-500/10 border border-amber-500/20 text-amber-700 p-4 rounded-lg flex items-center gap-3">
          <AlertCircle className="h-5 w-5" />
          <p className="text-sm font-medium">You are viewing this record in read-only mode.</p>
        </div>
      )}

      {/* The Form Paper Container */}
      <div className="bg-white dark:bg-card border shadow-xl rounded-sm p-8 md:p-12 print:shadow-none print:border-none print:p-0">
        
        {/* Form Header */}
        <div className="flex justify-between items-start border-b-2 border-black dark:border-white pb-6 mb-8">
          <div className="flex items-center gap-4">
            <div className="h-16 w-16 bg-primary flex items-center justify-center text-primary-foreground font-bold text-xl rounded">
              BJP
            </div>
            <div>
              <h2 className="text-2xl font-bold text-black dark:text-white uppercase tracking-tight">Beit Jala Pharmaceutical Co.</h2>
              <p className="text-muted-foreground font-mono text-sm uppercase tracking-widest mt-1">Engineering Department</p>
            </div>
          </div>
          <div className="text-right font-mono text-sm">
            <p className="font-bold border border-black dark:border-white px-2 py-1 uppercase">FORM-10-0118</p>
          </div>
        </div>

        <h3 className="text-xl font-bold text-center uppercase tracking-wider mb-10 text-black dark:text-white underline underline-offset-4">
          Equipment Information Record
        </h3>

        <Form {...form}>
          <form className="space-y-12 text-black dark:text-white">
            
            {/* 1. Identification */}
            <section>
              <h4 className="font-bold uppercase tracking-wider mb-4 border-b border-muted-foreground pb-1 text-sm text-primary">1. Identification</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4">
                <FormField control={form.control} name="nameOfEquipment" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="font-semibold">Name of Equipment</FormLabel>
                    <FormControl><Input {...field} readOnly={!canEdit} className="bg-transparent border-t-0 border-x-0 border-b border-black/20 dark:border-white/20 rounded-none px-0 focus-visible:ring-0 focus-visible:border-primary font-mono text-sm" /></FormControl>
                  </FormItem>
                )} />
                <FormField control={form.control} name="identificationNumber" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="font-semibold">Identification Number</FormLabel>
                    <FormControl><Input {...field} readOnly={!canEdit} className="bg-transparent border-t-0 border-x-0 border-b border-black/20 dark:border-white/20 rounded-none px-0 focus-visible:ring-0 focus-visible:border-primary font-mono text-sm" /></FormControl>
                  </FormItem>
                )} />
                <FormField control={form.control} name="modelNumber" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="font-semibold">Model Number</FormLabel>
                    <FormControl><Input {...field} readOnly={!canEdit} className="bg-transparent border-t-0 border-x-0 border-b border-black/20 dark:border-white/20 rounded-none px-0 focus-visible:ring-0 focus-visible:border-primary font-mono text-sm" /></FormControl>
                  </FormItem>
                )} />
                <FormField control={form.control} name="serialNumber" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="font-semibold">Serial Number</FormLabel>
                    <FormControl><Input {...field} readOnly={!canEdit} className="bg-transparent border-t-0 border-x-0 border-b border-black/20 dark:border-white/20 rounded-none px-0 focus-visible:ring-0 focus-visible:border-primary font-mono text-sm" /></FormControl>
                  </FormItem>
                )} />
                <FormField control={form.control} name="datePurchased" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="font-semibold">Date Purchased</FormLabel>
                    <FormControl><Input type="date" {...field} readOnly={!canEdit} className="bg-transparent border-t-0 border-x-0 border-b border-black/20 dark:border-white/20 rounded-none px-0 focus-visible:ring-0 focus-visible:border-primary font-mono text-sm" /></FormControl>
                  </FormItem>
                )} />
              </div>
            </section>

            {/* 2. Supplier Info */}
            <section>
              <h4 className="font-bold uppercase tracking-wider mb-4 border-b border-muted-foreground pb-1 text-sm text-primary">2. Supplier Information</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4">
                <FormField control={form.control} name="purchasedFromName" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="font-semibold">Purchased From (Company Name)</FormLabel>
                    <FormControl><Input {...field} readOnly={!canEdit} className="bg-transparent border-t-0 border-x-0 border-b border-black/20 dark:border-white/20 rounded-none px-0 focus-visible:ring-0 focus-visible:border-primary font-mono text-sm" /></FormControl>
                  </FormItem>
                )} />
                <FormField control={form.control} name="purchasedFromAddress" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="font-semibold">Address / Contact</FormLabel>
                    <FormControl><Input {...field} readOnly={!canEdit} className="bg-transparent border-t-0 border-x-0 border-b border-black/20 dark:border-white/20 rounded-none px-0 focus-visible:ring-0 focus-visible:border-primary font-mono text-sm" /></FormControl>
                  </FormItem>
                )} />
              </div>
            </section>

            {/* 3. Manufacturer Info */}
            <section>
              <h4 className="font-bold uppercase tracking-wider mb-4 border-b border-muted-foreground pb-1 text-sm text-primary">3. Manufacturer Information</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4">
                <FormField control={form.control} name="manufacturingCompanyName" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="font-semibold">Manufacturing Company Name</FormLabel>
                    <FormControl><Input {...field} readOnly={!canEdit} className="bg-transparent border-t-0 border-x-0 border-b border-black/20 dark:border-white/20 rounded-none px-0 focus-visible:ring-0 focus-visible:border-primary font-mono text-sm" /></FormControl>
                  </FormItem>
                )} />
                <FormField control={form.control} name="manufacturingCompanyAddress" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="font-semibold">Address / Country</FormLabel>
                    <FormControl><Input {...field} readOnly={!canEdit} className="bg-transparent border-t-0 border-x-0 border-b border-black/20 dark:border-white/20 rounded-none px-0 focus-visible:ring-0 focus-visible:border-primary font-mono text-sm" /></FormControl>
                  </FormItem>
                )} />
              </div>
            </section>

            {/* 4. Physical */}
            <section>
              <h4 className="font-bold uppercase tracking-wider mb-4 border-b border-muted-foreground pb-1 text-sm text-primary">4. Physical Characteristics</h4>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-x-8 gap-y-4">
                <FormField control={form.control} name="dimensionWidthCm" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="font-semibold">Width (cm)</FormLabel>
                    <FormControl><Input type="number" {...field} value={field.value || ""} readOnly={!canEdit} className="bg-transparent border-t-0 border-x-0 border-b border-black/20 dark:border-white/20 rounded-none px-0 focus-visible:ring-0 focus-visible:border-primary font-mono text-sm" /></FormControl>
                  </FormItem>
                )} />
                <FormField control={form.control} name="dimensionHeightCm" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="font-semibold">Height (cm)</FormLabel>
                    <FormControl><Input type="number" {...field} value={field.value || ""} readOnly={!canEdit} className="bg-transparent border-t-0 border-x-0 border-b border-black/20 dark:border-white/20 rounded-none px-0 focus-visible:ring-0 focus-visible:border-primary font-mono text-sm" /></FormControl>
                  </FormItem>
                )} />
                <FormField control={form.control} name="dimensionDepthCm" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="font-semibold">Depth (cm)</FormLabel>
                    <FormControl><Input type="number" {...field} value={field.value || ""} readOnly={!canEdit} className="bg-transparent border-t-0 border-x-0 border-b border-black/20 dark:border-white/20 rounded-none px-0 focus-visible:ring-0 focus-visible:border-primary font-mono text-sm" /></FormControl>
                  </FormItem>
                )} />
                <FormField control={form.control} name="weightKg" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="font-semibold">Weight (kg)</FormLabel>
                    <FormControl><Input type="number" {...field} value={field.value || ""} readOnly={!canEdit} className="bg-transparent border-t-0 border-x-0 border-b border-black/20 dark:border-white/20 rounded-none px-0 focus-visible:ring-0 focus-visible:border-primary font-mono text-sm" /></FormControl>
                  </FormItem>
                )} />
              </div>
            </section>

            {/* 5. Utilities */}
            <section>
              <h4 className="font-bold uppercase tracking-wider mb-4 border-b border-muted-foreground pb-1 text-sm text-primary">5. Utilities Requirements</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4">
                <FormField control={form.control} name="utilitiesPowerSupply" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="font-semibold">Power Supply (V/Hz/Ph/A/kW)</FormLabel>
                    <FormControl><Input {...field} readOnly={!canEdit} className="bg-transparent border-t-0 border-x-0 border-b border-black/20 dark:border-white/20 rounded-none px-0 focus-visible:ring-0 focus-visible:border-primary font-mono text-sm" /></FormControl>
                  </FormItem>
                )} />
                <FormField control={form.control} name="utilitiesAir" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="font-semibold">Compressed Air (Bar/CFM)</FormLabel>
                    <FormControl><Input {...field} readOnly={!canEdit} className="bg-transparent border-t-0 border-x-0 border-b border-black/20 dark:border-white/20 rounded-none px-0 focus-visible:ring-0 focus-visible:border-primary font-mono text-sm" /></FormControl>
                  </FormItem>
                )} />
                <FormField control={form.control} name="utilitiesWater" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="font-semibold">Water (Type/Pressure/Temp)</FormLabel>
                    <FormControl><Input {...field} readOnly={!canEdit} className="bg-transparent border-t-0 border-x-0 border-b border-black/20 dark:border-white/20 rounded-none px-0 focus-visible:ring-0 focus-visible:border-primary font-mono text-sm" /></FormControl>
                  </FormItem>
                )} />
                <FormField control={form.control} name="utilitiesOther" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="font-semibold">Other Utilities (Steam/Gas/etc.)</FormLabel>
                    <FormControl><Input {...field} readOnly={!canEdit} className="bg-transparent border-t-0 border-x-0 border-b border-black/20 dark:border-white/20 rounded-none px-0 focus-visible:ring-0 focus-visible:border-primary font-mono text-sm" /></FormControl>
                  </FormItem>
                )} />
              </div>
            </section>

            {/* 6. Notes */}
            <section>
              <h4 className="font-bold uppercase tracking-wider mb-4 border-b border-muted-foreground pb-1 text-sm text-primary">6. Safety & Additional Notes</h4>
              <div className="space-y-6">
                <FormField control={form.control} name="safetyIssues" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="font-semibold">Safety Issues / Warnings</FormLabel>
                    <FormControl><Textarea {...field} readOnly={!canEdit} className="bg-transparent border border-black/20 dark:border-white/20 rounded min-h-[80px] focus-visible:ring-1 focus-visible:border-primary font-mono text-sm resize-none" /></FormControl>
                  </FormItem>
                )} />
                <FormField control={form.control} name="others" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="font-semibold">Other Relevant Information</FormLabel>
                    <FormControl><Textarea {...field} readOnly={!canEdit} className="bg-transparent border border-black/20 dark:border-white/20 rounded min-h-[80px] focus-visible:ring-1 focus-visible:border-primary font-mono text-sm resize-none" /></FormControl>
                  </FormItem>
                )} />
              </div>
            </section>

            {/* Signatures */}
            <section className="pt-8 mt-12 border-t-2 border-black dark:border-white">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
                <div className="space-y-4">
                  <FormField control={form.control} name="preparedByName" render={({ field }) => (
                    <FormItem>
                      <FormLabel className="font-semibold">Prepared By (Name & Signature)</FormLabel>
                      <FormControl><Input {...field} readOnly={!canEdit} className="bg-transparent border-t-0 border-x-0 border-b border-black/20 dark:border-white/20 rounded-none px-0 focus-visible:ring-0 focus-visible:border-primary font-mono text-sm" /></FormControl>
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="preparedByDate" render={({ field }) => (
                    <FormItem>
                      <FormLabel className="font-semibold">Date</FormLabel>
                      <FormControl><Input type="date" {...field} readOnly={!canEdit} className="bg-transparent border-t-0 border-x-0 border-b border-black/20 dark:border-white/20 rounded-none px-0 focus-visible:ring-0 focus-visible:border-primary font-mono text-sm w-1/2" /></FormControl>
                    </FormItem>
                  )} />
                </div>
                <div className="space-y-4">
                  <FormField control={form.control} name="approvedByName" render={({ field }) => (
                    <FormItem>
                      <FormLabel className="font-semibold">Approved By (Name & Signature)</FormLabel>
                      <FormControl><Input {...field} readOnly={!canEdit} className="bg-transparent border-t-0 border-x-0 border-b border-black/20 dark:border-white/20 rounded-none px-0 focus-visible:ring-0 focus-visible:border-primary font-mono text-sm" /></FormControl>
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="approvedByDate" render={({ field }) => (
                    <FormItem>
                      <FormLabel className="font-semibold">Date</FormLabel>
                      <FormControl><Input type="date" {...field} readOnly={!canEdit} className="bg-transparent border-t-0 border-x-0 border-b border-black/20 dark:border-white/20 rounded-none px-0 focus-visible:ring-0 focus-visible:border-primary font-mono text-sm w-1/2" /></FormControl>
                    </FormItem>
                  )} />
                </div>
              </div>
            </section>

          </form>
        </Form>
      </div>
    </div>
  );
}
