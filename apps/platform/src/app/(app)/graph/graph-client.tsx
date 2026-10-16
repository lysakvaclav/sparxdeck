"use client";

import dynamic from "next/dynamic";
import { Spinner } from "@/components/ui/spinner";
import type { GraphData } from "@/lib/graph";

// The canvas is interactive only (it reads the saved view from this browser), so
// it renders on the client; the server sends the data.
const GraphWorkspace = dynamic(() => import("./graph-workspace"), {
  ssr: false,
  loading: () => (
    <div className="flex min-h-0 flex-1 items-center justify-center bg-canvas">
      <Spinner size={30} />
    </div>
  ),
});

export function GraphClient(props: {
  data: GraphData;
  organizationId: string;
  canEdit: boolean;
  focusId: string | null;
}) {
  return <GraphWorkspace {...props} />;
}
