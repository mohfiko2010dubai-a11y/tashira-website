import { useState } from "react";
import { Helmet } from "react-helmet-async";
import { KeyRound, AlertTriangle, CheckCircle } from "lucide-react";
import { trpc } from "@/providers/trpc-client";
import AdminTopNav from "@/components/admin/AdminTopNav";

export default function AdminSecurity() {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [done, setDone] = useState(false);
  const changeMutation = trpc.auth.adminChangePassword.useMutation({
    onSuccess: () => {
      setDone(true);
      setCurrentPassword(""); setNewPassword(""); setConfirmPassword("");
    },
  });

  const policyOk = newPassword.length >= 12 && /[a-z]/.test(newPassword) && /[A-Z]/.test(newPassword) && /\d/.test(newPassword);
  const matches = newPassword === confirmPassword;
  const canSubmit = currentPassword.length > 0 && policyOk && matches && newPassword !== currentPassword && !changeMutation.isPending;

  return (
    <div className="min-h-screen bg-[#F5F3EE]">
      <Helmet><title>Admin Security | Tashira</title></Helmet>
      <AdminTopNav title="Security" subtitle="Admin Password" />
      <div className="max-w-lg mx-auto px-4 py-10">
        <p className="text-sm text-gray-500 mt-2">
          Changing the password signs out every other admin session immediately (this session stays signed in).
        </p>

        <form
          className="mt-6 bg-white rounded-xl shadow border border-gray-100 p-6 space-y-4"
          onSubmit={(e) => { e.preventDefault(); if (canSubmit) changeMutation.mutate({ currentPassword, newPassword, confirmPassword }); }}
        >
          <label className="grid gap-1 text-sm font-medium text-gray-700">
            Current password
            <input type="password" autoComplete="current-password" required value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              className="rounded-lg border border-gray-300 px-3 py-2.5 focus:border-[#C9A04C] focus:ring-1 focus:ring-[#C9A04C] outline-none" />
          </label>
          <label className="grid gap-1 text-sm font-medium text-gray-700">
            New password
            <input type="password" autoComplete="new-password" required value={newPassword}
              onChange={(e) => { setNewPassword(e.target.value); setDone(false); }}
              className="rounded-lg border border-gray-300 px-3 py-2.5 focus:border-[#C9A04C] focus:ring-1 focus:ring-[#C9A04C] outline-none" />
          </label>
          <label className="grid gap-1 text-sm font-medium text-gray-700">
            Confirm new password
            <input type="password" autoComplete="new-password" required value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="rounded-lg border border-gray-300 px-3 py-2.5 focus:border-[#C9A04C] focus:ring-1 focus:ring-[#C9A04C] outline-none" />
          </label>

          <ul className="text-xs space-y-1">
            <li className={policyOk ? "text-emerald-600" : "text-gray-400"}>
              At least 12 characters, with upper-case, lower-case and a digit
            </li>
            <li className={matches && confirmPassword ? "text-emerald-600" : "text-gray-400"}>Confirmation matches the new password</li>
            <li className={newPassword !== currentPassword || !newPassword ? "text-emerald-600" : "text-amber-600"}>Different from the current password</li>
          </ul>

          {changeMutation.error && (
            <p className="text-sm text-red-600 flex items-center gap-1"><AlertTriangle size={14} /> {changeMutation.error.message}</p>
          )}
          {done && (
            <p className="text-sm text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2 flex items-center gap-1">
              <CheckCircle size={14} /> Password changed. All other admin sessions were signed out.
            </p>
          )}

          <button type="submit" disabled={!canSubmit}
            className="w-full py-3 rounded-lg font-semibold text-white bg-gradient-to-br from-[#C9A04C] to-[#DDBB7A] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2">
            <KeyRound size={16} /> {changeMutation.isPending ? "Changing…" : "Change password"}
          </button>
        </form>
      </div>
    </div>
  );
}
