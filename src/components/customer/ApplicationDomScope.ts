import { createContext } from "react";

/** Scope validation focus when the canonical form is embedded in the assistant. */
export const ApplicationDomScope = createContext<HTMLElement | null>(null);
