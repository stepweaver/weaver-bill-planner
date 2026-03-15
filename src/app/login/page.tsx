import { Suspense } from "react";
import { LoginForm } from "@/features/auth/login-form";

export default function LoginPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/30 p-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center">
          <h1 className="text-2xl font-semibold"><span className="text-primary">λ</span>ledger</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Sign in to continue
          </p>
        </div>
        <Suspense fallback={<div className="h-10 animate-pulse rounded bg-muted" />}>
          <LoginForm />
        </Suspense>
      </div>
    </div>
  );
}
