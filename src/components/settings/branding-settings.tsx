"use client";

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

interface BrandingSettingsProps {
  settings: OperatorSettings;
  onUpdate: (update: Partial<OperatorSettings>) => void;
  disabled?: boolean;
}

export function BrandingSettings({
  settings,
  onUpdate,
  disabled,
}: BrandingSettingsProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Branding</CardTitle>
        <CardDescription>
          Customize the appearance of outbound emails with your brand color and
          logo.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="brandColor">Brand Color</Label>
          <div className="flex items-center gap-2">
            <Input
              id="brandColor"
              type="color"
              value={settings.brandColor}
              onChange={(e) => onUpdate({ brandColor: e.target.value })}
              disabled={disabled}
              className="h-10 w-14 cursor-pointer p-1"
            />
            <Input
              type="text"
              value={settings.brandColor}
              onChange={(e) => {
                const val = e.target.value;
                if (/^#[0-9a-fA-F]{6}$/.test(val)) {
                  onUpdate({ brandColor: val });
                }
              }}
              disabled={disabled}
              placeholder="#2563eb"
              className="w-32 font-mono text-sm"
            />
          </div>
          <p className="text-xs text-muted-foreground">
            Used as the header bar color in HTML emails.
          </p>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="logoUrl">Logo URL</Label>
          <Input
            id="logoUrl"
            type="url"
            value={settings.logoUrl ?? ""}
            onChange={(e) =>
              onUpdate({ logoUrl: e.target.value || null })
            }
            onBlur={(e) =>
              onUpdate({ logoUrl: e.target.value || null })
            }
            disabled={disabled}
            placeholder="https://example.com/logo.png"
          />
          <p className="text-xs text-muted-foreground">
            Optional URL to your logo image. Displayed at the top of emails.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
