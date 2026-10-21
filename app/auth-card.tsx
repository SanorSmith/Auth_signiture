import { Brand } from "./brand";

// Centred card for the signed-out screens (sign in, forgot password).
export function AuthCard({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-4 py-10">
      <div className="mb-6">
        <Brand size="lg" />
      </div>
      <div className="card w-full max-w-sm p-6 sm:p-7">
        <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
        {description && <p className="mt-1 text-sm text-muted">{description}</p>}
        <div className="mt-5">{children}</div>
      </div>
    </main>
  );
}
