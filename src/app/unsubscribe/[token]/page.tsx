// ---------------------------------------------------------------------------
// Public unsubscribe page — one-click opt-out via signed token
// ---------------------------------------------------------------------------

import { db } from "@/lib/db";
import { verifyUnsubscribeToken } from "@/lib/comms/unsubscribe";
import { optOut } from "@/lib/db/queries/communication-opt-outs";

interface UnsubscribePageProps {
  params: Promise<{ token: string }>;
}

export default async function UnsubscribePage({ params }: UnsubscribePageProps) {
  const { token } = await params;
  const decoded = await verifyUnsubscribeToken(token);

  if (!decoded) {
    return (
      <main className="flex min-h-screen items-center justify-center p-4">
        <div className="max-w-md text-center">
          <h1 className="text-2xl font-bold mb-4">Invalid or Expired Link</h1>
          <p className="text-muted-foreground">
            This unsubscribe link is no longer valid. It may have expired or
            already been used. Please contact your flight school for assistance.
          </p>
        </div>
      </main>
    );
  }

  // Record the opt-out
  await optOut(db, decoded.operatorId, decoded.studentId, decoded.channel);

  const channelLabel = decoded.channel === "email" ? "email" : "SMS";

  return (
    <main className="flex min-h-screen items-center justify-center p-4">
      <div className="max-w-md text-center">
        <h1 className="text-2xl font-bold mb-4">Unsubscribed</h1>
        <p className="text-muted-foreground">
          You have been unsubscribed from {channelLabel} notifications. You will
          no longer receive {channelLabel} messages from this flight school.
        </p>
        <p className="text-sm text-muted-foreground mt-4">
          If you change your mind, contact your flight school to re-enable
          notifications.
        </p>
      </div>
    </main>
  );
}
