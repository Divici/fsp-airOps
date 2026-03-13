// ---------------------------------------------------------------------------
// Public Discovery Flight Intake Page
// Server component — no auth required. For prospective students.
// ---------------------------------------------------------------------------

import { DiscoveryIntakeForm } from "@/components/discovery/intake-form";

interface PageProps {
  params: Promise<{ operatorSlug: string }>;
}

export default async function DiscoveryFlightPage({ params }: PageProps) {
  const { operatorSlug } = await params;

  // In a real implementation, resolve operatorSlug to operatorId via DB lookup.
  // For now, use a simple numeric fallback.
  const operatorId = parseInt(operatorSlug, 10) || 1;

  return (
    <main className="min-h-screen bg-gradient-to-b from-sky-50 to-white flex items-center justify-center p-4">
      <div className="w-full max-w-lg">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Book a Discovery Flight
          </h1>
          <p className="text-gray-600">
            Experience the thrill of flying! Fill out the form below and
            we&apos;ll find the perfect time for your first flight.
          </p>
        </div>
        <DiscoveryIntakeForm operatorId={operatorId} />
      </div>
    </main>
  );
}
