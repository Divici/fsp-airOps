"use client";

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

interface CommunicationPreferencesProps {
  settings: OperatorSettings;
  onUpdate: (update: Partial<OperatorSettings>) => void;
  disabled?: boolean;
}

export function CommunicationPreferences({
  settings,
  onUpdate,
  disabled,
}: CommunicationPreferencesProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Communication Preferences</CardTitle>
        <CardDescription>
          Configure how notifications are sent when proposals are generated.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <div className="flex flex-col gap-0.5">
            <Label>Email notifications</Label>
            <p className="text-xs text-muted-foreground">
              Receive email alerts for new proposals.
            </p>
          </div>
          <Switch
            checked={settings.communicationPreferences.email}
            onCheckedChange={(checked) =>
              onUpdate({
                communicationPreferences: {
                  ...settings.communicationPreferences,
                  email: checked,
                },
              })
            }
            disabled={disabled}
          />
        </div>

        <div className="flex items-center justify-between">
          <div className="flex flex-col gap-0.5">
            <Label>SMS notifications</Label>
            <p className="text-xs text-muted-foreground">
              Receive text message alerts for urgent proposals.
            </p>
          </div>
          <Switch
            checked={settings.communicationPreferences.sms}
            onCheckedChange={(checked) =>
              onUpdate({
                communicationPreferences: {
                  ...settings.communicationPreferences,
                  sms: checked,
                },
              })
            }
            disabled={disabled}
          />
        </div>
      </CardContent>
    </Card>
  );
}
