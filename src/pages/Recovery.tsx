import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { trpc } from "@/providers/trpc-client";

export default function Recovery() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [secret, setSecret] = useState("");
  const [message, setMessage] = useState("");
  const request = trpc.recovery.request.useMutation();
  const verify = trpc.recovery.verify.useMutation();
  const token = params.get("token") || "";

  useEffect(() => {
    if (!token || verify.isPending || verify.isSuccess) return;
    verify.mutate({ secret: token }, {
      onSuccess: (result) => result.authenticated
        ? navigate(`/pay/${encodeURIComponent(result.referenceNumber)}`, { replace: true })
        : setMessage("This recovery link is invalid, expired, or already used."),
      onError: () => setMessage("Unable to verify this recovery link."),
    });
  }, [navigate, token, verify]);

  const requestRecovery = (channel: "MAGIC_LINK" | "EMAIL_OTP") => {
    request.mutate({ email, channel }, { onSuccess: (result) => setMessage(result.message) });
  };
  const verifyOtp = () => {
    verify.mutate({ email, secret }, {
      onSuccess: (result) => result.authenticated
        ? navigate(`/pay/${encodeURIComponent(result.referenceNumber)}`, { replace: true })
        : setMessage("The code is invalid, expired, already used, or locked."),
    });
  };

  return (
    <section className="min-h-[70vh] px-4 py-16 bg-[#FAFAF7]">
      <div className="max-w-md mx-auto bg-white border border-gray-200 rounded-2xl p-6 shadow-sm space-y-5">
        <h1 className="text-2xl font-bold text-[#1A2332]">Resume your application</h1>
        {token ? <p>Verifying your secure single-use link…</p> : <>
          <label className="block text-sm font-medium">Email address
            <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} className="mt-2 w-full border rounded-lg px-3 py-3" autoComplete="email" />
          </label>
          <div className="flex gap-3">
            <button onClick={() => requestRecovery("MAGIC_LINK")} disabled={!email || request.isPending} className="flex-1 bg-[#C9A04C] text-white rounded-lg py-3 disabled:opacity-50">Email secure link</button>
            <button onClick={() => requestRecovery("EMAIL_OTP")} disabled={!email || request.isPending} className="flex-1 border rounded-lg py-3 disabled:opacity-50">Email code</button>
          </div>
          <label className="block text-sm font-medium">One-time code
            <input inputMode="numeric" maxLength={6} value={secret} onChange={(event) => setSecret(event.target.value.replace(/\D/g, ""))} className="mt-2 w-full border rounded-lg px-3 py-3 tracking-[0.4em]" autoComplete="one-time-code" />
          </label>
          <button onClick={verifyOtp} disabled={!email || secret.length !== 6 || verify.isPending} className="w-full bg-[#1A2332] text-white rounded-lg py-3 disabled:opacity-50">Verify code</button>
        </>}
        {message && <p role="status" className="text-sm text-gray-700">{message}</p>}
      </div>
    </section>
  );
}
