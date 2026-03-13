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
    // Clear field-level validation error on change
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

    // Build the request body
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

    // Client-side validation
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
      <div className="bg-white rounded-xl shadow-lg p-8 text-center">
        <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg
            className="w-8 h-8 text-green-600"
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
        <h2 className="text-2xl font-bold text-gray-900 mb-2">
          Request Submitted!
        </h2>
        <p className="text-gray-600 mb-6">
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
          className="text-sky-600 hover:text-sky-700 font-medium"
        >
          Submit another request
        </button>
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="bg-white rounded-xl shadow-lg p-8 space-y-6"
    >
      {/* Name fields */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label
            htmlFor="firstName"
            className="block text-sm font-medium text-gray-700 mb-1"
          >
            First Name <span className="text-red-500">*</span>
          </label>
          <input
            id="firstName"
            name="firstName"
            type="text"
            required
            value={formData.firstName}
            onChange={handleChange}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900 placeholder-gray-400 focus:border-sky-500 focus:ring-1 focus:ring-sky-500 outline-none"
            placeholder="Jane"
          />
          {validationErrors.firstName && (
            <p className="mt-1 text-sm text-red-600">
              {validationErrors.firstName}
            </p>
          )}
        </div>
        <div>
          <label
            htmlFor="lastName"
            className="block text-sm font-medium text-gray-700 mb-1"
          >
            Last Name <span className="text-red-500">*</span>
          </label>
          <input
            id="lastName"
            name="lastName"
            type="text"
            required
            value={formData.lastName}
            onChange={handleChange}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900 placeholder-gray-400 focus:border-sky-500 focus:ring-1 focus:ring-sky-500 outline-none"
            placeholder="Doe"
          />
          {validationErrors.lastName && (
            <p className="mt-1 text-sm text-red-600">
              {validationErrors.lastName}
            </p>
          )}
        </div>
      </div>

      {/* Email */}
      <div>
        <label
          htmlFor="email"
          className="block text-sm font-medium text-gray-700 mb-1"
        >
          Email <span className="text-red-500">*</span>
        </label>
        <input
          id="email"
          name="email"
          type="email"
          required
          value={formData.email}
          onChange={handleChange}
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900 placeholder-gray-400 focus:border-sky-500 focus:ring-1 focus:ring-sky-500 outline-none"
          placeholder="jane@example.com"
        />
        {validationErrors.email && (
          <p className="mt-1 text-sm text-red-600">
            {validationErrors.email}
          </p>
        )}
      </div>

      {/* Phone */}
      <div>
        <label
          htmlFor="phone"
          className="block text-sm font-medium text-gray-700 mb-1"
        >
          Phone
        </label>
        <input
          id="phone"
          name="phone"
          type="tel"
          value={formData.phone}
          onChange={handleChange}
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900 placeholder-gray-400 focus:border-sky-500 focus:ring-1 focus:ring-sky-500 outline-none"
          placeholder="(555) 123-4567"
        />
      </div>

      {/* Preferred date */}
      <div>
        <label
          htmlFor="preferredDate"
          className="block text-sm font-medium text-gray-700 mb-1"
        >
          Preferred Date
        </label>
        <input
          id="preferredDate"
          name="preferredDate"
          type="date"
          value={formData.preferredDate}
          onChange={handleChange}
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900 placeholder-gray-400 focus:border-sky-500 focus:ring-1 focus:ring-sky-500 outline-none"
        />
      </div>

      {/* Preferred time of day */}
      <div>
        <label
          htmlFor="preferredTimeOfDay"
          className="block text-sm font-medium text-gray-700 mb-1"
        >
          Preferred Time of Day
        </label>
        <select
          id="preferredTimeOfDay"
          name="preferredTimeOfDay"
          value={formData.preferredTimeOfDay}
          onChange={handleChange}
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900 focus:border-sky-500 focus:ring-1 focus:ring-sky-500 outline-none"
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
          className="block text-sm font-medium text-gray-700 mb-1"
        >
          Notes
        </label>
        <textarea
          id="notes"
          name="notes"
          rows={3}
          value={formData.notes}
          onChange={handleChange}
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900 placeholder-gray-400 focus:border-sky-500 focus:ring-1 focus:ring-sky-500 outline-none resize-none"
          placeholder="Any special requests or questions..."
        />
      </div>

      {/* Error message */}
      {state === "error" && errorMessage && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3">
          <p className="text-sm text-red-700">{errorMessage}</p>
        </div>
      )}

      {/* Submit */}
      <button
        type="submit"
        disabled={state === "submitting"}
        className="w-full bg-sky-600 hover:bg-sky-700 disabled:bg-sky-300 text-white font-medium py-3 px-4 rounded-lg transition-colors"
      >
        {state === "submitting" ? "Submitting..." : "Request Discovery Flight"}
      </button>
    </form>
  );
}
