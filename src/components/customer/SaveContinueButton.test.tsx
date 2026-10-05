import { beforeEach, describe, expect, it, vi } from "vitest";
import { SaveContinueButton } from "./SaveContinueButton";

const mocks = vi.hoisted(() => ({ request: vi.fn(), validate: vi.fn(), state: vi.fn() }));
vi.mock("react", async importOriginal => ({
  ...await importOriginal<typeof import("react")>(),
  useState: (value: unknown) => [value, mocks.state],
  useRef: (value: unknown) => ({ current: value }),
}));
vi.mock("react-i18next", () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock("./useValidationFeedback", () => ({ useValidationFeedback: () => ({ validate: mocks.validate, count: 0, fieldProps: () => ({}), errorFor: () => null }) }));
vi.mock("@/providers/trpc-client", () => ({ trpc: { recovery: { request: { useMutation: () => ({ mutateAsync: mocks.request, isPending: false, isError: false }) } } } }));

describe("Save and exit delivery ordering", () => {
  beforeEach(() => { vi.clearAllMocks(); mocks.validate.mockReturnValue(true); mocks.request.mockResolvedValue({}); });
  const event = () => ({ preventDefault: vi.fn(), currentTarget: {} });

  it("waits for persisted details and suppresses a second click while saving", async () => {
    let finishSave: (() => void) | undefined;
    const beforeSend = vi.fn(() => new Promise<void>(resolve => { finishSave = resolve; }));
    const form = SaveContinueButton({ email: "Owner@example.com", referenceNumber: "TSH-SYNTHETIC", beforeSend });
    const pending = form.props.onSubmit(event());
    await form.props.onSubmit(event());
    expect(beforeSend).toHaveBeenCalledTimes(1);
    expect(mocks.request).not.toHaveBeenCalled();
    finishSave?.();
    await pending;
    expect(mocks.request).toHaveBeenCalledExactlyOnceWith({ email: "owner@example.com", referenceNumber: "TSH-SYNTHETIC", channel: "MAGIC_LINK" });
  });

  it("does not send a saved confirmation when persistence fails, and allows retry", async () => {
    const beforeSend = vi.fn().mockRejectedValueOnce(new Error("Save failed")).mockResolvedValueOnce(undefined);
    const form = SaveContinueButton({ email: "owner@example.com", referenceNumber: "TSH-SYNTHETIC", beforeSend });
    await form.props.onSubmit(event());
    expect(mocks.request).not.toHaveBeenCalled();
    expect(mocks.state).toHaveBeenCalledWith(true);
    await form.props.onSubmit(event());
    expect(mocks.request).toHaveBeenCalledTimes(1);
  });

  it("does not save or send while the traveller form is busy or email is invalid", async () => {
    const beforeSend = vi.fn();
    await SaveContinueButton({ email: "owner@example.com", beforeSend, disabled: true }).props.onSubmit(event());
    mocks.validate.mockReturnValue(false);
    await SaveContinueButton({ email: "notanemail", beforeSend }).props.onSubmit(event());
    expect(beforeSend).not.toHaveBeenCalled();
    expect(mocks.request).not.toHaveBeenCalled();
  });
});
