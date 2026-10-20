import { logout } from "@/lib/actions";

export function Header({ title, email }: { title: string; email: string }) {
  return (
    <header className="flex items-center justify-between border-b px-6 py-3">
      <h1 className="text-lg font-semibold">{title}</h1>
      <form action={logout} className="flex items-center gap-3 text-sm">
        <span className="text-neutral-500">{email}</span>
        <button className="rounded border px-3 py-1 hover:bg-neutral-100 dark:hover:bg-neutral-800">Log out</button>
      </form>
    </header>
  );
}
