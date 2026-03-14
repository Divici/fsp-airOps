"use client";

import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { OperatorSettings } from "@/lib/hooks/use-operator-settings";

interface RankingWeightsProps {
  settings: OperatorSettings;
  onUpdate: (update: Partial<OperatorSettings>) => void;
  disabled?: boolean;
}

interface WeightEntry {
  label: string;
  key: keyof OperatorSettings;
  value: number;
  color: string;
}

export function RankingWeights({
  settings,
  onUpdate,
  disabled,
}: RankingWeightsProps) {
  const weights: WeightEntry[] = [
    {
      label: "Time since last flight",
      key: "timeSinceLastFlightWeight",
      value: settings.timeSinceLastFlightWeight,
      color: "bg-blue-500",
    },
    {
      label: "Time until next flight",
      key: "timeUntilNextFlightWeight",
      value: settings.timeUntilNextFlightWeight,
      color: "bg-green-500",
    },
    {
      label: "Total flight hours",
      key: "totalFlightHoursWeight",
      value: settings.totalFlightHoursWeight,
      color: "bg-amber-500",
    },
  ];

  const toggleWeights: {
    label: string;
    toggleKey: keyof OperatorSettings;
    weightKey: keyof OperatorSettings;
    toggleValue: boolean;
    weightValue: number;
    color: string;
  }[] = [
    {
      label: "Instructor continuity preference",
      toggleKey: "preferSameInstructor",
      weightKey: "preferSameInstructorWeight",
      toggleValue: settings.preferSameInstructor,
      weightValue: settings.preferSameInstructorWeight,
      color: "bg-purple-500",
    },
    {
      label: "Aircraft familiarity preference",
      toggleKey: "preferSameAircraft",
      weightKey: "preferSameAircraftWeight",
      toggleValue: settings.preferSameAircraft,
      weightValue: settings.preferSameAircraftWeight,
      color: "bg-rose-500",
    },
  ];

  // Compute total for distribution bar
  const allWeightValues = [
    ...weights.map((w) => w.value),
    ...toggleWeights.map((w) => (w.toggleValue ? w.weightValue : 0)),
  ];
  const allColors = [
    ...weights.map((w) => w.color),
    ...toggleWeights.map((w) => w.color),
  ];
  const total = allWeightValues.reduce((sum, v) => sum + v, 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Ranking Weights</CardTitle>
        <CardDescription>
          Adjust how the system prioritizes students when generating scheduling
          suggestions. Higher weights give more importance to that signal.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-6">
        {/* Simple weight sliders */}
        {weights.map((w) => (
          <div key={w.key} className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <Label>{w.label}</Label>
              <span className="text-sm font-medium tabular-nums text-muted-foreground">
                {w.value.toFixed(1)}
              </span>
            </div>
            <Slider
              value={w.value}
              onValueChange={(val) => onUpdate({ [w.key]: val })}
              min={0}
              max={10}
              step={0.1}
              disabled={disabled}
            />
          </div>
        ))}

        {/* Toggle + weight sliders */}
        {toggleWeights.map((w) => (
          <div key={w.toggleKey} className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Switch
                  checked={w.toggleValue}
                  onCheckedChange={(checked) =>
                    onUpdate({ [w.toggleKey]: checked })
                  }
                  disabled={disabled}
                />
                <Label>{w.label}</Label>
              </div>
              <span className="text-sm font-medium tabular-nums text-muted-foreground">
                {w.toggleValue ? w.weightValue.toFixed(1) : "off"}
              </span>
            </div>
            {w.toggleValue && (
              <Slider
                value={w.weightValue}
                onValueChange={(val) => onUpdate({ [w.weightKey]: val })}
                min={0}
                max={10}
                step={0.1}
                disabled={disabled}
              />
            )}
          </div>
        ))}

        {/* Weight distribution bar */}
        {total > 0 && (
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs text-muted-foreground">
              Weight distribution
            </Label>
            <div
              className="flex h-3 w-full overflow-hidden rounded-full"
              data-testid="weight-distribution-bar"
            >
              {allWeightValues.map((val, i) => {
                if (val === 0) return null;
                const pct = (val / total) * 100;
                return (
                  <div
                    key={i}
                    className={`${allColors[i]} transition-all`}
                    style={{ width: `${pct}%` }}
                  />
                );
              })}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
