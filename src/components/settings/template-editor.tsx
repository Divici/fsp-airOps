"use client";

import { useState, useCallback, useMemo } from "react";
import { RotateCcw, Eye, EyeOff } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import {
  getDefaultTemplates,
  extractTemplateVariables,
  renderTemplate,
} from "@/lib/comms/templates";
import type { MessageTemplate } from "@/lib/comms/templates";

/** Shape of each template as returned from the templates API. */
interface TemplateData {
  id: string;
  subject: string;
  body: string;
  variables: string[];
  isCustom: boolean;
}

interface TemplateEditorProps {
  templates: Record<string, TemplateData> | null;
  onSave: (
    templates: Record<string, { subject: string; body: string }> | null
  ) => void;
  disabled?: boolean;
}

/** Pretty-print template IDs for display. */
function formatTemplateName(id: string): string {
  return id
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

/** Sample data for template preview rendering. */
const SAMPLE_VARIABLES: Record<string, string> = {
  dispatcherName: "Jane Doe",
  workflowType: "reschedule",
  studentName: "John Smith",
  summary: "Move lesson from Tuesday to Thursday",
  date: "March 20, 2026",
  time: "2:00 PM",
  location: "KPAO - Palo Alto Airport",
  operatorName: "Bay Area Flight School",
  reservationId: "RES-20260320-001",
  instructorName: "Mike Rodriguez",
  aircraftTail: "N12345",
  prospectName: "Sam Johnson",
  contactPhone: "(555) 123-4567",
  proposedTime: "10:00 AM",
};

function SingleTemplateEditor({
  templateId,
  data,
  onChange,
  onReset,
  disabled,
}: {
  templateId: string;
  data: TemplateData;
  onChange: (id: string, field: "subject" | "body", value: string) => void;
  onReset: (id: string) => void;
  disabled?: boolean;
}) {
  const [showPreview, setShowPreview] = useState(false);

  const preview = useMemo(() => {
    const template: MessageTemplate = {
      id: templateId,
      subject: data.subject,
      body: data.body,
    };
    return renderTemplate(template, SAMPLE_VARIABLES);
  }, [templateId, data.subject, data.body]);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h4 className="text-sm font-medium">
            {formatTemplateName(templateId)}
          </h4>
          {data.isCustom && (
            <Badge variant="secondary">Customized</Badge>
          )}
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon-xs"
            onClick={() => setShowPreview(!showPreview)}
            title={showPreview ? "Hide preview" : "Show preview"}
          >
            {showPreview ? (
              <EyeOff className="size-3.5" />
            ) : (
              <Eye className="size-3.5" />
            )}
          </Button>
          {data.isCustom && (
            <Button
              variant="ghost"
              size="icon-xs"
              onClick={() => onReset(templateId)}
              disabled={disabled}
              title="Reset to default"
            >
              <RotateCcw className="size-3.5" />
            </Button>
          )}
        </div>
      </div>

      <div className="flex flex-wrap gap-1">
        {data.variables.map((v) => (
          <Badge key={v} variant="outline" className="text-[10px] font-mono">
            {`{{${v}}}`}
          </Badge>
        ))}
      </div>

      <div className="flex flex-col gap-2">
        <div>
          <Label className="text-xs text-muted-foreground">Subject</Label>
          <Input
            value={data.subject}
            onChange={(e) =>
              onChange(templateId, "subject", e.target.value)
            }
            disabled={disabled}
            placeholder="Email subject line"
          />
        </div>
        <div>
          <Label className="text-xs text-muted-foreground">Body</Label>
          <Textarea
            value={data.body}
            onChange={(e) =>
              onChange(templateId, "body", e.target.value)
            }
            disabled={disabled}
            rows={6}
            className="font-mono text-xs"
          />
        </div>
      </div>

      {showPreview && (
        <div className="rounded-lg border bg-muted/30 p-3">
          <p className="mb-1 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
            Preview
          </p>
          {preview.subject && (
            <p className="mb-2 text-sm font-medium">{preview.subject}</p>
          )}
          <pre className="whitespace-pre-wrap text-xs leading-relaxed text-foreground/80">
            {preview.body}
          </pre>
        </div>
      )}
    </div>
  );
}

export function TemplateEditor({
  templates: initialTemplates,
  onSave,
  disabled,
}: TemplateEditorProps) {
  const defaults = useMemo(() => getDefaultTemplates(), []);
  const defaultVariables = useMemo(() => {
    const vars: Record<string, string[]> = {};
    for (const [id, t] of Object.entries(defaults)) {
      vars[id] = extractTemplateVariables(t);
    }
    return vars;
  }, [defaults]);

  // Build initial editor state from API data or defaults
  const buildEditorState = useCallback((): Record<string, TemplateData> => {
    const state: Record<string, TemplateData> = {};
    for (const [id, t] of Object.entries(defaults)) {
      const custom = initialTemplates?.[id];
      state[id] = {
        id,
        subject: custom ? custom.subject : (t.subject ?? ""),
        body: custom ? custom.body : t.body,
        variables: defaultVariables[id],
        isCustom: custom ? custom.isCustom : false,
      };
    }
    return state;
  }, [defaults, defaultVariables, initialTemplates]);

  const [editorState, setEditorState] = useState<Record<string, TemplateData>>(
    buildEditorState
  );

  const handleChange = useCallback(
    (id: string, field: "subject" | "body", value: string) => {
      setEditorState((prev) => {
        const updated = {
          ...prev,
          [id]: { ...prev[id], [field]: value, isCustom: true },
        };

        // Compute overrides: only include templates that differ from defaults
        const overrides: Record<string, { subject: string; body: string }> = {};
        for (const [tid, tdata] of Object.entries(updated)) {
          const def = defaults[tid];
          if (
            def &&
            (tdata.subject !== (def.subject ?? "") || tdata.body !== def.body)
          ) {
            overrides[tid] = { subject: tdata.subject, body: tdata.body };
          }
        }

        onSave(Object.keys(overrides).length > 0 ? overrides : null);
        return updated;
      });
    },
    [defaults, onSave]
  );

  const handleReset = useCallback(
    (id: string) => {
      const def = defaults[id];
      if (!def) return;

      setEditorState((prev) => {
        const updated = {
          ...prev,
          [id]: {
            ...prev[id],
            subject: def.subject ?? "",
            body: def.body,
            isCustom: false,
          },
        };

        // Recompute overrides
        const overrides: Record<string, { subject: string; body: string }> = {};
        for (const [tid, tdata] of Object.entries(updated)) {
          const d = defaults[tid];
          if (
            d &&
            (tdata.subject !== (d.subject ?? "") || tdata.body !== d.body)
          ) {
            overrides[tid] = { subject: tdata.subject, body: tdata.body };
          }
        }

        onSave(Object.keys(overrides).length > 0 ? overrides : null);
        return updated;
      });
    },
    [defaults, onSave]
  );

  const templateIds = Object.keys(editorState);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Communication Templates</CardTitle>
        <CardDescription>
          Customize the messages sent to students and dispatchers. Use{" "}
          <code className="rounded bg-muted px-1 py-0.5 text-xs font-mono">
            {"{{variable}}"}
          </code>{" "}
          placeholders for dynamic content. Reset individual templates to
          restore defaults.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {templateIds.map((id, index) => (
          <div key={id}>
            <SingleTemplateEditor
              templateId={id}
              data={editorState[id]}
              onChange={handleChange}
              onReset={handleReset}
              disabled={disabled}
            />
            {index < templateIds.length - 1 && (
              <Separator className="mt-4" />
            )}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
