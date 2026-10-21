import type { Permission } from "@/lib/permissions";
import { Header } from "./header";

const widths = { sm: "max-w-xl", md: "max-w-3xl", lg: "max-w-5xl" } as const;

type Props = {
  title: string;
  description?: string;
  user: { email: string; perms: Permission[] };
  width?: keyof typeof widths;
  children: React.ReactNode;
};

// Signed-in page frame: sticky header, page title, centred content column.
export function Shell({ title, description, user, width = "md", children }: Props) {
  return (
    <div className="flex min-h-screen flex-col">
      <Header email={user.email} perms={user.perms} />
      <main className={`mx-auto w-full flex-1 px-4 py-6 sm:px-6 sm:py-8 ${widths[width]}`}>
        <div className="mb-6">
          <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
          {description && <p className="mt-1 text-sm text-muted">{description}</p>}
        </div>
        {children}
      </main>
    </div>
  );
}
