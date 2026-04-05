import { Suspense } from "react";
import { LoginForm } from "@/features/auth/login-form";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function LoginPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/30 p-6">
      <Card className="w-full max-w-[22rem] shrink-0 shadow-md">
        <CardHeader className="space-y-1 text-center pb-2">
          <CardTitle className="text-xl font-semibold">
            <span className="text-primary">λ</span>ledger
          </CardTitle>
          <CardDescription>Sign in to continue</CardDescription>
        </CardHeader>
        <CardContent className="px-5 pb-5 pt-0">
          <Suspense
            fallback={<div className="h-10 animate-pulse rounded-md bg-muted" aria-hidden />}
          >
            <LoginForm />
          </Suspense>
        </CardContent>
      </Card>
    </div>
  );
}
