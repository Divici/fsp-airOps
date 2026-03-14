"use client";

import { Loader2, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { Skeleton } from "@/components/ui/skeleton";
import {
  useOperatorSettings,
  useUpdateOperatorSettings,
} from "@/lib/hooks/use-operator-settings";
import type { OperatorSettings } from "@/lib/hooks/use-operator-settings";
import { RankingWeights } from "./ranking-weights";
import { SchedulingPreferences } from "./scheduling-preferences";
import { CommunicationPreferences } from "./communication-preferences";
import { AutoApprovalSettings } from "./auto-approval-settings";
import { ResetDefaultsButton } from "./reset-defaults-button";

export function SettingsForm() {
  const { data: settings, isLoading, isError } = useOperatorSettings();
  const updateMutation = useUpdateOperatorSettings();

  function handleUpdate(update: Partial<OperatorSettings>) {
    updateMutation.mutate(update, {
      onError: () => {
        toast.error("Failed to save setting", {
          description: "Please try again.",
        });
      },
    });
  }

  if (isLoading) {
    return <SettingsFormSkeleton />;
  }

  if (isError || !settings) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 py-16 text-destructive">
        <AlertCircle className="size-8 opacity-60" />
        <p className="text-sm font-medium">Failed to load settings</p>
        <p className="text-xs text-muted-foreground">
          Please try refreshing the page.
        </p>
      </div>
    );
  }

  const isSaving = updateMutation.isPending;

  return (
    <div className="flex flex-col gap-6">
      {/* Saving indicator */}
      {isSaving && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Loader2 className="size-3 animate-spin" />
          Saving...
        </div>
      )}

      <RankingWeights
        settings={settings}
        onUpdate={handleUpdate}
        disabled={isSaving}
      />

      <SchedulingPreferences
        settings={settings}
        onUpdate={handleUpdate}
        disabled={isSaving}
      />

      <CommunicationPreferences
        settings={settings}
        onUpdate={handleUpdate}
        disabled={isSaving}
      />

      <AutoApprovalSettings
        enabled={settings.autoApprovalEnabled}
        threshold={settings.autoApprovalThreshold}
        onUpdate={handleUpdate}
        disabled={isSaving}
      />

      <div className="flex justify-end">
        <ResetDefaultsButton />
      </div>
    </div>
  );
}

function SettingsFormSkeleton() {
  return (
    <div className="flex flex-col gap-6" data-testid="settings-form-skeleton">
      {Array.from({ length: 3 }).map((_, i) => (
        <Skeleton key={i} className="h-64 w-full rounded-xl" />
      ))}
    </div>
  );
}
