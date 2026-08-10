import { useCallback, useEffect, useRef, useState } from "react";
import { trpc } from "@/providers/trpc-client";

type SafeFailureCategory = "card_declined" | "authentication_failed" | "processing_error" | "network_error" | "cancelled" | "unknown";
type ClientPaymentEvent = "CHECKOUT_OPENED" | "PAYMENT_ELEMENT_LOADED" | "PAYMENT_STARTED" |
  "PAYMENT_FAILED" | "PAYMENT_RETRIED" | "CHECKOUT_ABANDONED" | "PAYMENT_PAGE_CLOSED";

export function usePaymentTimeline(referenceNumber: string) {
  const [sessionReference] = useState(() => crypto.randomUUID());
  const eventMutation = trpc.timeline.recordPaymentEvent.useMutation();
  const mutateRef = useRef(eventMutation.mutate);
  const started = useRef(false);
  const terminal = useRef(false);
  const attempts = useRef(0);

  useEffect(() => {
    mutateRef.current = eventMutation.mutate;
  }, [eventMutation.mutate]);

  const record = useCallback((eventName: ClientPaymentEvent, options?: {
    failureCategory?: SafeFailureCategory;
  }) => {
    mutateRef.current({ referenceNumber, eventName, sessionReference, ...options });
  }, [referenceNumber, sessionReference]);

  useEffect(() => {
    record("CHECKOUT_OPENED");
    return () => {
      record("PAYMENT_PAGE_CLOSED");
      if (started.current && !terminal.current) record("CHECKOUT_ABANDONED");
    };
  }, [record]);

  const paymentElementLoaded = useCallback(() => record("PAYMENT_ELEMENT_LOADED"), [record]);
  const paymentStarted = useCallback(() => {
      attempts.current += 1;
      if (attempts.current > 1) record("PAYMENT_RETRIED");
      started.current = true;
      record("PAYMENT_STARTED");
  }, [record]);
  const paymentFailed = useCallback((failureCategory: SafeFailureCategory = "unknown") => {
      record("PAYMENT_FAILED", { failureCategory });
  }, [record]);
  const paymentConfirmed = useCallback(() => {
      terminal.current = true;
  }, []);

  return { paymentElementLoaded, paymentStarted, paymentFailed, paymentConfirmed };
}

export function safeStripeFailureCategory(code?: string): SafeFailureCategory {
  if (code === "card_declined") return "card_declined";
  if (code === "payment_intent_authentication_failure") return "authentication_failed";
  if (code === "processing_error") return "processing_error";
  return "unknown";
}
