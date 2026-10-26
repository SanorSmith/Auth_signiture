import type { Permission } from "@/lib/permissions";
import { getT } from "@/lib/lang";
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
export async function Shell({ title, description, user, width = "md", children }: Props) {
  const t = await getT();
  return (
    <div className="flex min-h-screen flex-col">
      <Header email={user.email} perms={user.perms} />
      <main className={`mx-auto w-full flex-1 px-3 py-4 sm:px-6 sm:py-8 ${widths[width]}`}>
        <div className="mb-4 sm:mb-6">
          <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">{t(title)}</h1>
          {/* The sentence under the title is skipped on small screens to keep the work area in view. */}
          {description && <p className="mt-1 hidden text-sm text-muted sm:block">{t(description)}</p>}
        </div>
        {children}
      </main>
    </div>
  );
}
