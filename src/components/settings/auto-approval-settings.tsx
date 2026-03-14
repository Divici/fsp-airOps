"use client";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Zap } from "lucide-react";

interface AutoApprovalSettingsProps {
  enabled: boolean;
  threshold: number;
  onUpdate: (update: {
    autoApprovalEnabled?: boolean;
    autoApprovalThreshold?: number;
  }) => void;
  disabled?: boolean;
}

export function AutoApprovalSettings({
  enabled,
  threshold,
  onUpdate,
  disabled,
}: AutoApprovalSettingsProps) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Zap className="size-4 text-purple-500" />
          <CardTitle>AI Auto-Approval</CardTitle>
        </div>
        <CardDescription>
          When enabled, the AI agent evaluates new proposals and automatically
          approves low-risk scheduling changes without human review.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {/* Master toggle */}
        <div className="flex items-center justify-between">
          <Label htmlFor="auto-approval-toggle">Enable auto-approval</Label>
          <Switch
            id="auto-approval-toggle"
            checked={enabled}
            onCheckedChange={(checked) =>
              onUpdate({ autoApprovalEnabled: checked })
            }
            disabled={disabled}
          />
        </div>

        {/* Confidence threshold slider — only visible when enabled */}
        {enabled && (
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="threshold-slider">Confidence threshold</Label>
              <span className="text-sm font-medium tabular-nums">
                {Math.round(threshold * 100)}%
              </span>
            </div>
            <input
              id="threshold-slider"
              type="range"
              min={50}
              max={95}
              step={5}
              value={Math.round(threshold * 100)}
              onChange={(e) =>
                onUpdate({
                  autoApprovalThreshold: Number(e.target.value) / 100,
                })
              }
              disabled={disabled}
              className="w-full accent-purple-500"
            />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Cautious (95%)</span>
              <span>Balanced (70%)</span>
              <span>Aggressive (50%)</span>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              The AI investigates each proposal — checking slot availability,
              student history, instructor schedules, and weather — then
              auto-approves if its confidence meets this threshold.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
