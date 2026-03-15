"use client";

import { useState } from "react";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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

type CustomWeight = OperatorSettings["customWeights"][number];
type CustomSignalName = CustomWeight["signal"];

const CUSTOM_SIGNAL_OPTIONS = [
  { value: "daysSinceLastFlight", label: "Days since last flight" },
  { value: "daysUntilExpiry", label: "Days until expiry" },
  { value: "totalHours", label: "Total hours" },
  { value: "lessonCompletionRate", label: "Lesson completion rate" },
] as const;

export function RankingWeights({
  settings,
  onUpdate,
  disabled,
}: RankingWeightsProps) {
  const [showAddForm, setShowAddForm] = useState(false);
  const [newName, setNewName] = useState("");
  const [newSignal, setNewSignal] = useState<CustomSignalName | "">("");
  const [newWeight, setNewWeight] = useState(1.0);

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

  const customWeights = settings.customWeights ?? [];

  // Compute total for distribution bar
  const allWeightValues = [
    ...weights.map((w) => w.value),
    ...toggleWeights.map((w) => (w.toggleValue ? w.weightValue : 0)),
    ...customWeights.filter((cw) => cw.enabled).map((cw) => cw.weight),
  ];
  const allColors = [
    ...weights.map((w) => w.color),
    ...toggleWeights.map((w) => w.color),
    ...customWeights.filter((cw) => cw.enabled).map(() => "bg-teal-500"),
  ];
  const total = allWeightValues.reduce((sum, v) => sum + v, 0);

  function handleAddCustomWeight() {
    if (!newName.trim() || !newSignal) return;

    const updated: CustomWeight[] = [
      ...customWeights,
      {
        name: newName.trim(),
        signal: newSignal as CustomSignalName,
        weight: newWeight,
        enabled: true,
      },
    ];
    onUpdate({ customWeights: updated });
    setNewName("");
    setNewSignal("");
    setNewWeight(1.0);
    setShowAddForm(false);
  }

  function handleRemoveCustomWeight(index: number) {
    const updated = customWeights.filter((_, i) => i !== index);
    onUpdate({ customWeights: updated });
  }

  function handleToggleCustomWeight(index: number, enabled: boolean) {
    const updated = customWeights.map((cw, i) =>
      i === index ? { ...cw, enabled } : cw,
    );
    onUpdate({ customWeights: updated });
  }

  function handleCustomWeightChange(index: number, weight: number) {
    const updated = customWeights.map((cw, i) =>
      i === index ? { ...cw, weight } : cw,
    );
    onUpdate({ customWeights: updated });
  }

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

        {/* Custom Weights Section */}
        <div className="flex flex-col gap-4 border-t pt-4">
          <div className="flex items-center justify-between">
            <Label className="text-base font-semibold">Custom Weights</Label>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowAddForm(!showAddForm)}
              disabled={disabled}
              data-testid="add-custom-weight-button"
            >
              {showAddForm ? "Cancel" : "Add Custom Weight"}
            </Button>
          </div>

          {/* Add form */}
          {showAddForm && (
            <div
              className="flex flex-col gap-3 rounded-md border p-3"
              data-testid="custom-weight-form"
            >
              <div className="flex flex-col gap-1.5">
                <Label className="text-xs">Name</Label>
                <Input
                  placeholder="e.g. Recency bonus"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  disabled={disabled}
                  data-testid="custom-weight-name-input"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label className="text-xs">Signal</Label>
                <Select
                  value={newSignal}
                  onValueChange={(val) => setNewSignal((val ?? "") as CustomSignalName | "")}
                  disabled={disabled}
                >
                  <SelectTrigger data-testid="custom-weight-signal-select">
                    <SelectValue placeholder="Select a signal" />
                  </SelectTrigger>
                  <SelectContent>
                    {CUSTOM_SIGNAL_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-1.5">
                <div className="flex items-center justify-between">
                  <Label className="text-xs">Weight</Label>
                  <span className="text-sm font-medium tabular-nums text-muted-foreground">
                    {newWeight.toFixed(1)}
                  </span>
                </div>
                <Slider
                  value={newWeight}
                  onValueChange={(val) => setNewWeight(val)}
                  min={0}
                  max={10}
                  step={0.1}
                  disabled={disabled}
                />
              </div>
              <Button
                size="sm"
                onClick={handleAddCustomWeight}
                disabled={disabled || !newName.trim() || !newSignal}
                data-testid="save-custom-weight-button"
              >
                Save
              </Button>
            </div>
          )}

          {/* Existing custom weights list */}
          {customWeights.length === 0 && !showAddForm && (
            <p className="text-sm text-muted-foreground">
              No custom weights defined. Add one to extend the ranking logic.
            </p>
          )}

          {customWeights.map((cw, index) => (
            <div
              key={`${cw.name}-${index}`}
              className="flex flex-col gap-2"
              data-testid={`custom-weight-${index}`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Switch
                    checked={cw.enabled}
                    onCheckedChange={(checked) =>
                      handleToggleCustomWeight(index, checked)
                    }
                    disabled={disabled}
                  />
                  <Label>{cw.name}</Label>
                  <span className="text-xs text-muted-foreground">
                    ({CUSTOM_SIGNAL_OPTIONS.find((o) => o.value === cw.signal)?.label ?? cw.signal})
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium tabular-nums text-muted-foreground">
                    {cw.enabled ? cw.weight.toFixed(1) : "off"}
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleRemoveCustomWeight(index)}
                    disabled={disabled}
                    data-testid={`remove-custom-weight-${index}`}
                  >
                    Remove
                  </Button>
                </div>
              </div>
              {cw.enabled && (
                <Slider
                  value={cw.weight}
                  onValueChange={(val) =>
                    handleCustomWeightChange(index, val)
                  }
                  min={0}
                  max={10}
                  step={0.1}
                  disabled={disabled}
                />
              )}
            </div>
          ))}
        </div>

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
