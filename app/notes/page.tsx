import { requirePermission } from "@/lib/session";
import { Shell } from "../shell";
import { NoteTablePanel } from "./note-table-panel";
import { SavedTablePanel } from "./saved-table-panel";

export default async function NotesPage() {
  const s = await requirePermission("note_table");
  return (
    <Shell title="Delivery notes" description="Photograph the pages of a delivery note and get one table with the item number, the delivered quantity and the description, to copy." user={s} width="lg">
      <div className="flex flex-col gap-6">
        <SavedTablePanel />
        <NoteTablePanel />
      </div>
    </Shell>
  );
}
