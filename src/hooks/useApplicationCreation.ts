import { useCallback, useEffect, useRef, useState } from "react";
import { trpc } from "@/providers/trpc-client";

type CreationRequest = { requestKey: string; referenceNumber: string | null };
export function useApplicationCreation(flow: "FORM" | "CHAT" | "LEGACY") {
  const { mutateAsync, isPending, error } = trpc.application.prepareCreation.useMutation();
  const [request, setRequest] = useState<CreationRequest | null>(null);
  const cached = useRef<CreationRequest | null>(null);
  const inFlight = useRef<Promise<CreationRequest> | null>(null);
  const getRequest = useCallback((startNew = false): Promise<CreationRequest> => {
    if (inFlight.current) return inFlight.current;
    if (cached.current && !startNew) return Promise.resolve(cached.current);
    const pending = mutateAsync({ flow, startNew }).then(result => {
      cached.current = result; setRequest(result); return result;
    }).finally(() => { inFlight.current = null; });
    inFlight.current = pending;
    return pending;
  }, [flow, mutateAsync]);
  useEffect(() => { if (flow === "FORM") void getRequest().catch(() => undefined); }, [flow, getRequest]);
  const markCreated = (referenceNumber: string) => {
    if (cached.current) { cached.current = { ...cached.current, referenceNumber }; setRequest(cached.current); }
  };
  return { request, getRequest, markCreated, isPending, error };
}
