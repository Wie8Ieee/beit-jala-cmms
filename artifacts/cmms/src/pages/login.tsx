import { useState } from "react";
import { useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useLogin } from "@workspace/api-client-react";
import { TestTube, Loader2 } from "lucide-react";

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
import { useToast } from "@/hooks/use-toast";

const loginSchema = z.object({
  username: z.string().min(1, "Username is required"),
  password: z.string().min(1, "Password is required"),
});

export default function LoginPage() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const loginMutation = useLogin();

  const form = useForm<z.infer<typeof loginSchema>>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      username: "",
      password: "",
    },
  });

  function onSubmit(values: z.infer<typeof loginSchema>) {
    loginMutation.mutate({ data: values }, {
      onSuccess: () => {
        setLocation("/dashboard");
      },
      onError: (error) => {
        toast({
          variant: "destructive",
          title: "Authentication Failed",
          description: error.error || "Invalid username or password.",
        });
      }
    });
  }

  return (
    <div className="min-h-[100dvh] flex flex-col md:flex-row bg-background">
      {/* Left side - Branding & Vibe */}
      <div className="hidden md:flex flex-1 flex-col justify-between bg-primary p-12 text-primary-foreground relative overflow-hidden">
        {/* Abstract subtle grid pattern overlay */}
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#ffffff11_1px,transparent_1px),linear-gradient(to_bottom,#ffffff11_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)] pointer-events-none" />
        
        <div className="relative z-10 flex items-center gap-3">
          <div className="flex aspect-square size-12 items-center justify-center rounded-xl bg-white text-primary shadow-lg">
            <TestTube className="size-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Beit Jala</h1>
            <p className="text-sm text-primary-foreground/80 font-medium tracking-widest uppercase">Pharmaceutical Co.</p>
          </div>
        </div>

        <div className="relative z-10 max-w-md">
          <h2 className="text-4xl font-semibold mb-4 leading-tight">
            Computerized Maintenance Management System
          </h2>
          <p className="text-lg text-primary-foreground/80">
            Precision maintenance tracking for pharmaceutical-grade operational excellence.
          </p>
        </div>

        <div className="relative z-10 text-sm font-mono text-primary-foreground/60">
          SYSTEM VERSION 1.0.0
        </div>
      </div>

      {/* Right side - Login Form */}
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-sm space-y-8">
          <div className="space-y-2 text-center md:text-left">
            <h1 className="text-3xl font-semibold tracking-tight text-foreground">Sign In</h1>
            <p className="text-muted-foreground text-sm">
              Enter your credentials to access the system
            </p>
          </div>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <div className="space-y-4">
                <FormField
                  control={form.control}
                  name="username"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs font-semibold tracking-wide uppercase text-muted-foreground">
                        Username
                      </FormLabel>
                      <FormControl>
                        <Input 
                          placeholder="e.g. jsmith" 
                          {...field} 
                          className="h-12 bg-muted/50 border-muted focus-visible:bg-background transition-colors"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs font-semibold tracking-wide uppercase text-muted-foreground">
                        Password
                      </FormLabel>
                      <FormControl>
                        <Input 
                          type="password" 
                          {...field} 
                          className="h-12 bg-muted/50 border-muted focus-visible:bg-background transition-colors"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <Button 
                type="submit" 
                className="w-full h-12 text-md font-medium" 
                disabled={loginMutation.isPending}
              >
                {loginMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Authenticating...
                  </>
                ) : (
                  "Sign In"
                )}
              </Button>
            </form>
          </Form>

          <div className="text-center text-xs text-muted-foreground pt-8">
            Unauthorized access is strictly prohibited.
          </div>
        </div>
      </div>
    </div>
  );
}
