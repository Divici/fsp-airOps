"use client";

import { useState } from "react";
import { createProspectRequestSchema } from "@/lib/types/api";

// ---------------------------------------------------------------------------
// Time-of-day options mapped to hour ranges
// ---------------------------------------------------------------------------

const TIME_OF_DAY_OPTIONS = [
  { label: "Morning (8am - 12pm)", value: "morning", start: "8", end: "12" },
  { label: "Afternoon (12pm - 5pm)", value: "afternoon", start: "12", end: "17" },
  { label: "Evening (5pm - 7pm)", value: "evening", start: "17", end: "19" },
] as const;

type SubmitState = "idle" | "submitting" | "success" | "error";

interface DiscoveryIntakeFormProps {
  operatorId: number;
}

const inputClasses =
  "w-full rounded-lg border border-border bg-background px-3 py-2 text-foreground placeholder-muted-foreground focus:border-primary focus:ring-1 focus:ring-primary outline-none";

export function DiscoveryIntakeForm({ operatorId }: DiscoveryIntakeFormProps) {
  const [state, setState] = useState<SubmitState>("idle");
  const [errorMessage, setErrorMessage] = useState("");
  const [validationErrors, setValidationErrors] = useState<
    Record<string, string>
  >({});

  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    preferredDate: "",
    preferredTimeOfDay: "",
    notes: "",
  });

  function handleChange(
    e: React.ChangeEvent<
      HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
    >
  ) {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (validationErrors[name]) {
      setValidationErrors((prev) => {
        const next = { ...prev };
        delete next[name];
        return next;
      });
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setValidationErrors({});
    setErrorMessage("");

    const timeWindow = TIME_OF_DAY_OPTIONS.find(
      (o) => o.value === formData.preferredTimeOfDay
    );

    const requestBody = {
      operatorId,
      firstName: formData.firstName,
      lastName: formData.lastName,
      email: formData.email,
      phone: formData.phone || undefined,
      preferredDateStart: formData.preferredDate || undefined,
      preferredDateEnd: formData.preferredDate || undefined,
      preferredTimeWindows: timeWindow
        ? [{ start: timeWindow.start, end: timeWindow.end }]
        : undefined,
      notes: formData.notes || undefined,
    };

    const parsed = createProspectRequestSchema.safeParse(requestBody);
    if (!parsed.success) {
      const errors: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        const field = issue.path[0]?.toString() ?? "form";
        errors[field] = issue.message;
      }
      setValidationErrors(errors);
      return;
    }

    setState("submitting");

    try {
      const res = await fetch("/api/prospects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(parsed.data),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "Something went wrong");
      }

      setState("success");
    } catch (err) {
      setState("error");
      setErrorMessage(
        err instanceof Error ? err.message : "An unexpected error occurred"
      );
    }
  }

  // Success screen
  if (state === "success") {
    return (
      <div className="rounded-xl border border-border bg-card p-8 text-center shadow-lg">
        <div className="mx-auto mb-4 flex size-16 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/30">
          <svg
            className="size-8 text-green-600 dark:text-green-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M5 13l4 4L19 7"
            />
          </svg>
        </div>
        <h2 className="mb-2 text-2xl font-bold text-foreground">
          Request Submitted!
        </h2>
        <p className="mb-6 text-muted-foreground">
          Thank you for your interest in a discovery flight. We&apos;ll review
          your request and get back to you with available times shortly.
        </p>
        <button
          onClick={() => {
            setState("idle");
            setFormData({
              firstName: "",
              lastName: "",
              email: "",
              phone: "",
              preferredDate: "",
              preferredTimeOfDay: "",
              notes: "",
            });
          }}
          className="font-medium text-primary hover:text-primary/80"
        >
          Submit another request
        </button>
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-6 rounded-xl border border-border bg-card p-8 shadow-lg"
    >
      {/* Name fields */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label
            htmlFor="firstName"
            className="mb-1 block text-sm font-medium text-foreground"
          >
            First Name <span className="text-destructive">*</span>
          </label>
          <input
            id="firstName"
            name="firstName"
            type="text"
            required
            value={formData.firstName}
            onChange={handleChange}
            className={inputClasses}
            placeholder="Jane"
          />
          {validationErrors.firstName && (
            <p className="mt-1 text-sm text-destructive">
              {validationErrors.firstName}
            </p>
          )}
        </div>
        <div>
          <label
            htmlFor="lastName"
            className="mb-1 block text-sm font-medium text-foreground"
          >
            Last Name <span className="text-destructive">*</span>
          </label>
          <input
            id="lastName"
            name="lastName"
            type="text"
            required
            value={formData.lastName}
            onChange={handleChange}
            className={inputClasses}
            placeholder="Doe"
          />
          {validationErrors.lastName && (
            <p className="mt-1 text-sm text-destructive">
              {validationErrors.lastName}
            </p>
          )}
        </div>
      </div>

      {/* Email */}
      <div>
        <label
          htmlFor="email"
          className="mb-1 block text-sm font-medium text-foreground"
        >
          Email <span className="text-destructive">*</span>
        </label>
        <input
          id="email"
          name="email"
          type="email"
          required
          value={formData.email}
          onChange={handleChange}
          className={inputClasses}
          placeholder="jane@example.com"
        />
        {validationErrors.email && (
          <p className="mt-1 text-sm text-destructive">
            {validationErrors.email}
          </p>
        )}
      </div>

      {/* Phone */}
      <div>
        <label
          htmlFor="phone"
          className="mb-1 block text-sm font-medium text-foreground"
        >
          Phone
        </label>
        <input
          id="phone"
          name="phone"
          type="tel"
          value={formData.phone}
          onChange={handleChange}
          className={inputClasses}
          placeholder="(555) 123-4567"
        />
      </div>

      {/* Preferred date */}
      <div>
        <label
          htmlFor="preferredDate"
          className="mb-1 block text-sm font-medium text-foreground"
        >
          Preferred Date
        </label>
        <input
          id="preferredDate"
          name="preferredDate"
          type="date"
          value={formData.preferredDate}
          onChange={handleChange}
          className={inputClasses}
        />
      </div>

      {/* Preferred time of day */}
      <div>
        <label
          htmlFor="preferredTimeOfDay"
          className="mb-1 block text-sm font-medium text-foreground"
        >
          Preferred Time of Day
        </label>
        <select
          id="preferredTimeOfDay"
          name="preferredTimeOfDay"
          value={formData.preferredTimeOfDay}
          onChange={handleChange}
          className={inputClasses}
        >
          <option value="">No preference</option>
          {TIME_OF_DAY_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>

      {/* Notes */}
      <div>
        <label
          htmlFor="notes"
          className="mb-1 block text-sm font-medium text-foreground"
        >
          Notes
        </label>
        <textarea
          id="notes"
          name="notes"
          rows={3}
          value={formData.notes}
          onChange={handleChange}
          className={`${inputClasses} resize-none`}
          placeholder="Any special requests or questions..."
        />
      </div>

      {/* Error message */}
      {state === "error" && errorMessage && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3">
          <p className="text-sm text-destructive">{errorMessage}</p>
        </div>
      )}

      {/* Submit */}
      <button
        type="submit"
        disabled={state === "submitting"}
        className="w-full rounded-lg bg-primary px-4 py-3 font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:bg-primary/50"
      >
        {state === "submitting" ? "Submitting..." : "Request Discovery Flight"}
      </button>
    </form>
  );
}
