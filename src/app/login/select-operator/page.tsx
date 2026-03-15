"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Plane, Building2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";

interface Operator {
  id: number;
  name: string;
}

export default function SelectOperatorPage() {
  const router = useRouter();
  const [operators, setOperators] = useState<Operator[]>([]);
  const [selecting, setSelecting] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const stored = sessionStorage.getItem("pending-operators");
    if (!stored) {
      // No operators to select — redirect back to login
      router.replace("/login");
      return;
    }
    try {
      const parsed = JSON.parse(stored) as Operator[];
      if (parsed.length === 0) {
        router.replace("/login");
        return;
      }
      setOperators(parsed);
    } catch {
      router.replace("/login");
    }
  }, [router]);

  async function handleSelect(operatorId: number) {
    setSelecting(operatorId);
    setError(null);

    try {
      const res = await fetch("/api/auth/select-operator", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ operatorId }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error ?? "Failed to select operator.");
        setSelecting(null);
        return;
      }

      sessionStorage.removeItem("pending-operators");
      router.push("/");
      router.refresh();
    } catch {
      setError("Network error. Please try again.");
      setSelecting(null);
    }
  }

  if (operators.length === 0) {
    return null; // Redirecting
  }

  return (
    <div className="flex min-h-dvh items-center justify-center bg-gradient-to-b from-background to-muted/30 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-2 flex size-10 items-center justify-center rounded-lg bg-primary/10">
            <Plane className="size-5 text-primary" />
          </div>
          <CardTitle className="text-lg">Select Organization</CardTitle>
          <CardDescription>
            Choose which flight school to manage
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-2">
          {error && (
            <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </div>
          )}

          {operators.map((op) => (
            <Button
              key={op.id}
              variant="outline"
              className="flex h-auto w-full items-center justify-start gap-3 px-4 py-3"
              onClick={() => handleSelect(op.id)}
              disabled={selecting !== null}
            >
              <Building2 className="size-5 shrink-0 text-muted-foreground" />
              <span className="flex-1 text-left text-sm font-medium">
                {op.name}
              </span>
              {selecting === op.id && (
                <Loader2 className="size-4 animate-spin text-muted-foreground" />
              )}
            </Button>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
