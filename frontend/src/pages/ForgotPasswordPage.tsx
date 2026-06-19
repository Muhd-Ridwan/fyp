import { useState, type FormEvent } from "react";
import { CheckCircle } from "lucide-react";
import { getApiBaseUrl, handleResponse } from "../api/utils";
import AuthCard from "../components/auth/AuthCard";

export default function ForgotPasswordPage() {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [workEmail, setWorkEmail] = useState("");
  const [nric, setNric] = useState("");
  const [personalEmail, setPersonalEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleVerifyEmail(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      await handleResponse(
        await fetch(`${getApiBaseUrl()}/auth/forgot-password/verify-email`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ work_email: workEmail }),
        }),
      );
      setStep(2);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to verify email");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleSendReset(e: FormEvent) {
    e.preventDefault();
    setError(null);

    if (nric.length !== 4 || !/^[a-zA-Z0-9]{4}$/.test(nric)) {
      setError("NRIC must be exactly 4 alphanumeric characters");
      return;
    }

    setIsSubmitting(true);
    try {
      await handleResponse(
        await fetch(`${getApiBaseUrl()}/auth/forgot-password/send-reset`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            work_email: workEmail,
            nric_last4: nric.toUpperCase(),
            personal_email: personalEmail,
          }),
        }),
      );
      setStep(3);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to send reset link",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <AuthCard>
        {step === 1 && (
          <>
            <div className="mb-6">
              <h1 className="text-xl font-semibold text-slate-900">
                Forgot Password
              </h1>
              <p className="mt-1 text-sm text-slate-500">
                Enter your work email to get started
              </p>
            </div>
            <form onSubmit={handleVerifyEmail} className="space-y-4">
              <div>
                <label
                  htmlFor="workEmail"
                  className="mb-1 block text-sm font-medium text-slate-700"
                >
                  Work Email
                </label>
                <input
                  id="workEmail"
                  type="email"
                  required
                  value={workEmail}
                  onChange={(e) => setWorkEmail(e.target.value)}
                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500"
                  placeholder="john@company.com"
                />
              </div>
              {error && (
                <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
                  {error}
                </p>
              )}
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isSubmitting ? "Checking..." : "Continue"}
              </button>
              <a
                href="/login"
                className="block text-center text-sm text-slate-500 hover:text-slate-700"
              >
                Back to login
              </a>
            </form>
          </>
        )}
        {step === 2 && (
          <>
            <div className="mb-6">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
                Step 2 of 2
              </p>
              <h1 className="mt-1 text-xl font-semibold">
                Verify your identity
              </h1>
              <p className="mt-1 text-sm text-slate-500">
                Enter the details registered with your account.
              </p>
            </div>
            <form onSubmit={handleSendReset} className="space-y-4">
              <div>
                <label
                  htmlFor="nric"
                  className="mb-1 block text-sm font-medium text-slate-700"
                >
                  Last 4 character of NRIC / Passport
                </label>
                <input
                  id="nric"
                  type="text"
                  required
                  maxLength={4}
                  value={nric}
                  onChange={(e) => setNric(e.target.value.toUpperCase())}
                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm uppercase tracking-widest focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500"
                  placeholder="e.g. 567A"
                />
              </div>
              <div>
                <label
                  htmlFor="personalEmail"
                  className="mb-1 block text-sm font-medium text-slate-700"
                >
                  Personal Email
                </label>
                <input
                  id="personalEmail"
                  type="email"
                  required
                  value={personalEmail}
                  onChange={(e) => setPersonalEmail(e.target.value)}
                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500"
                  placeholder="john@gmail.com"
                />
              </div>
              {error && (
                <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
                  {error}
                </p>
              )}
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isSubmitting ? "Sending..." : "Send Reset Link"}
              </button>
            </form>
          </>
        )}
        {step === 3 && (
          <div className="text-center">
            <CheckCircle className="mx-auto mb-4 h-12 w-12 text-green-500" />
            <h1 className="text-xl font-semibold text-slate-900">Check your email</h1>
            <p className="mt-2 text-sm text-slate-500">
              A password reset link has been sent to your personal email. It expires in 30 minutes.
            </p>
            <a
              href="/login"
              className="mt-6 block text-sm font-medium text-slate-900 hover:underline"
            >
              Back to login
            </a>
          </div>
        )}
    </AuthCard>
  );
}
