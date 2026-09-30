import { expressPriceDelta } from "@contracts/price-delta";
import { useEffect, useState } from "react";
import { trpc } from "@/providers/trpc-client";

type Quote = { unitPrice: number; totalPrice: number; currency: string; applicantCount: number };
type Pair = { key: string; regular: Quote; express: Quote };

/** Fetch both options before selection; reject late responses from a previous service/count. */
export function useProcessingQuotes(visaType: string, applicantCount: number) {
  const { mutateAsync } = trpc.wizard.quoteApplication.useMutation();
  const [pair, setPair] = useState<Pair | null>(null);
  const [failedKey, setFailedKey] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const key = `${visaType}:${applicantCount}:${attempt}`;
  useEffect(() => {
    let active = true;
    const timer = setTimeout(() => {
      Promise.all([
        mutateAsync({ visaType, applicantCount, processingType: "regular" }),
        mutateAsync({ visaType, applicantCount, processingType: "express" }),
      ]).then(([regular, express]) => {
        if (regular.currency !== express.currency) throw new Error("Quote currencies differ");
        if (active) setPair({ key, regular, express });
      }).catch(() => { if (active) setFailedKey(key); });
    }, 250);
    return () => { active = false; clearTimeout(timer); };
  }, [visaType, applicantCount, key, mutateAsync]);
  const current = pair?.key === key ? pair : null;
  return { regular: current?.regular, express: current?.express, failed: failedKey === key,
    loading: !current && failedKey !== key, retry: () => setAttempt(value => value + 1),
    unitDelta: current ? expressPriceDelta(current.regular.unitPrice, current.express.unitPrice) : undefined,
    totalDelta: current ? expressPriceDelta(current.regular.totalPrice, current.express.totalPrice) : undefined };
}
