"use client";

import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { OperatorSettings } from "@/lib/hooks/use-operator-settings";

interface SchedulingPreferencesProps {
  settings: OperatorSettings;
  onUpdate: (update: Partial<OperatorSettings>) => void;
  disabled?: boolean;
}

const workflowOptions: {
  key: keyof OperatorSettings["enabledWorkflows"];
  label: string;
  description: string;
}[] = [
  {
    key: "reschedule",
    label: "Reschedule",
    description: "Suggest alternatives when lessons are cancelled",
  },
  {
    key: "discovery_flight",
    label: "Discovery Flight",
    description: "Auto-schedule discovery flights from intake forms",
  },
  {
    key: "next_lesson",
    label: "Next Lesson",
    description: "Suggest next lesson after lesson completion",
  },
  {
    key: "waitlist",
    label: "Waitlist",
    description: "Fill openings from the waitlist when cancellations occur",
  },
  {
    key: "inactivity_outreach",
    label: "Inactivity Outreach",
    description: "Reach out to students who haven't flown recently with scheduling suggestions",
  },
];

export function SchedulingPreferences({
  settings,
  onUpdate,
  disabled,
}: SchedulingPreferencesProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Scheduling Preferences</CardTitle>
        <CardDescription>
          Configure how the system searches for and suggests schedule
          alternatives.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-6">
        {/* Search window */}
        <div className="flex flex-col gap-2">
          <Label htmlFor="search-window">Search window (days)</Label>
          <p className="text-xs text-muted-foreground">
            How far ahead the system looks for available slots (1-30 days).
          </p>
          <Input
            id="search-window"
            type="number"
            min={1}
            max={30}
            value={settings.searchWindowDays}
            onChange={(e) =>
              onUpdate({
                searchWindowDays: Math.min(
                  30,
                  Math.max(1, parseInt(e.target.value) || 1)
                ),
              })
            }
            disabled={disabled}
            className="w-24"
          />
        </div>

        {/* Top N alternatives */}
        <div className="flex flex-col gap-2">
          <Label htmlFor="top-n">Top N alternatives</Label>
          <p className="text-xs text-muted-foreground">
            Maximum number of alternative suggestions per proposal (1-20).
          </p>
          <Input
            id="top-n"
            type="number"
            min={1}
            max={20}
            value={settings.topNAlternatives}
            onChange={(e) =>
              onUpdate({
                topNAlternatives: Math.min(
                  20,
                  Math.max(1, parseInt(e.target.value) || 1)
                ),
              })
            }
            disabled={disabled}
            className="w-24"
          />
        </div>

        {/* Daylight only */}
        <div className="flex items-center gap-3">
          <Switch
            checked={settings.daylightOnly}
            onCheckedChange={(checked) => onUpdate({ daylightOnly: checked })}
            disabled={disabled}
          />
          <div className="flex flex-col">
            <Label>Daylight only</Label>
            <p className="text-xs text-muted-foreground">
              Only suggest flights during daylight hours.
            </p>
          </div>
        </div>

        {/* Inactivity threshold */}
        <div className="flex flex-col gap-2">
          <Label htmlFor="inactivity-threshold">
            Inactivity threshold (days)
          </Label>
          <p className="text-xs text-muted-foreground">
            Students with no flights in this many days will be flagged for
            outreach (3-30 days).
          </p>
          <Input
            id="inactivity-threshold"
            type="number"
            min={3}
            max={30}
            value={settings.inactivityThresholdDays}
            onChange={(e) =>
              onUpdate({
                inactivityThresholdDays: Math.min(
                  30,
                  Math.max(3, parseInt(e.target.value) || 7)
                ),
              })
            }
            disabled={disabled}
            className="w-24"
          />
        </div>

        {/* Enabled workflows */}
        <div className="flex flex-col gap-3">
          <Label>Enabled workflows</Label>
          <p className="text-xs text-muted-foreground">
            Select which scheduling workflows the system should actively run.
          </p>
          <div className="flex flex-col gap-2.5">
            {workflowOptions.map((wf) => (
              <label
                key={wf.key}
                className="flex items-start gap-2.5 cursor-pointer"
              >
                <Checkbox
                  checked={settings.enabledWorkflows[wf.key]}
                  onCheckedChange={(checked) =>
                    onUpdate({
                      enabledWorkflows: {
                        ...settings.enabledWorkflows,
                        [wf.key]: checked,
                      },
                    })
                  }
                  disabled={disabled}
                />
                <div className="flex flex-col gap-0.5">
                  <span className="text-sm font-medium leading-none">
                    {wf.label}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {wf.description}
                  </span>
                </div>
              </label>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
