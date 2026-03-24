import type { ReactNode } from "react";
import LastTripTracker from "@/components/trip/LastTripTracker";

type LayoutProps = {
  children: ReactNode;
  params: Promise<{ tripId: string }>;
};

export default async function TripSegmentLayout({ children, params }: LayoutProps) {
  const { tripId } = await params;

  return (
    <>
      <LastTripTracker tripId={tripId} />
      {children}
    </>
  );
}
