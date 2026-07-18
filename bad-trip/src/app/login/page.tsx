import { Suspense } from "react";
import { Navbar } from "@/components/Navbar";
import { AuthForm } from "@/components/AuthForm";

export default function LoginPage() {
  return (
    <div className="min-h-screen">
      <Navbar />
      <main className="mx-auto max-w-md px-4 py-16">
        <Suspense fallback={null}>
          <AuthForm mode="login" />
        </Suspense>
      </main>
    </div>
  );
}
