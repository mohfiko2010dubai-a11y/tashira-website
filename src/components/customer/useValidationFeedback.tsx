import { useId, useState } from "react";

export function focusInvalidField(form: HTMLElement) {
  const control = form.querySelector<HTMLElement>('[aria-invalid="true"]');
  control?.scrollIntoView({ block: "center", behavior: "smooth" });
  control?.focus({ preventScroll: true });
}

/** Errors use the caller's existing validation rules; drafts stay in the form. */
export function useValidationFeedback(errors: Record<string, string | undefined>, nativeMessage?: string) {
  const prefix = useId();
  const [submitted, setSubmitted] = useState(false);
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [nativeErrors, setNativeErrors] = useState<Record<string, string>>({});
  const collectNativeErrors = (form: HTMLFormElement) => {
    const next: Record<string, string> = {};
    if (nativeMessage) form.querySelectorAll<HTMLInputElement | HTMLSelectElement>("input[data-validation-key], select[data-validation-key]").forEach(control => {
      if (!control.validity.valid) next[control.dataset.validationKey!] = nativeMessage;
    });
    setNativeErrors(next);
    return next;
  };
  const visibleError = (key: string) => (submitted || touched[key]) ? errors[key] || nativeErrors[key] : undefined;
  const count = [...new Set([...Object.keys(errors), ...Object.keys(nativeErrors)])].filter(key => visibleError(key)).length;
  const fieldProps = (key: string, helperId?: string) => ({
    id: `${prefix}-${key}`,
    "data-validation-key": key,
    "aria-invalid": Boolean(visibleError(key)),
    "aria-describedby": [helperId, visibleError(key) ? `${prefix}-${key}-error` : undefined].filter(Boolean).join(" ") || undefined,
    onBlur: () => { setTouched(previous => ({ ...previous, [key]: true })); },
  });
  const errorFor = (key: string) => visibleError(key) ? <span id={`${prefix}-${key}-error`} className="block text-sm text-red-700">
    <span aria-hidden="true">⚠ </span>{visibleError(key)}
  </span> : null;
  const validate = (form: HTMLFormElement) => {
    setSubmitted(true);
    const native = collectNativeErrors(form);
    if (!Object.values(errors).some(Boolean) && !Object.keys(native).length) return true;
    // Wait for the error controls and descriptions to be committed before focusing.
    requestAnimationFrame(() => focusInvalidField(form));
    return false;
  };
  return { fieldProps, errorFor, count, validate, revalidateNative: collectNativeErrors };
}
