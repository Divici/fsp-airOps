"use client";

import { useState } from "react";
import { RotateCcw, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useResetOperatorSettings } from "@/lib/hooks/use-operator-settings";

export function ResetDefaultsButton() {
  const [open, setOpen] = useState(false);
  const resetMutation = useResetOperatorSettings();

  function handleReset() {
    resetMutation.mutate(undefined, {
      onSuccess: () => {
        setOpen(false);
        toast.success("Settings reset to defaults");
      },
      onError: () => {
        toast.error("Failed to reset settings", {
          description: "Please try again.",
        });
      },
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="outline" />}>
        <RotateCcw className="size-4" data-icon="inline-start" />
        Reset to Defaults
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Reset Settings</DialogTitle>
          <DialogDescription>
            This will restore all settings to their default values. Any
            customizations will be lost. Are you sure?
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => setOpen(false)}
            disabled={resetMutation.isPending}
          >
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={handleReset}
            disabled={resetMutation.isPending}
          >
            {resetMutation.isPending && (
              <Loader2 className="size-4 animate-spin" data-icon="inline-start" />
            )}
            Reset All Settings
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
