// Unit tests for the delivery note table helpers. Run: npx tsx scripts/test-note-table.ts
import { duplicateItems, mergeDuplicates, quantity, type NoteRow } from "../lib/note-table";

let failures = 0;
const check = (name: string, ok: boolean, extra?: unknown) => {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${ok ? "" : "  " + JSON.stringify(extra)}`);
  if (!ok) failures++;
};

check("a whole number", quantity("12") === 12 && quantity(" 7 ") === 7);
check("a decimal comma and a decimal point", quantity("12,5") === 12.5 && quantity("12.5") === 12.5 && quantity("0,25") === 0.25);
check("thousands with a space, a point or a comma", quantity("1 200") === 1200 && quantity("1.200") === 1200 && quantity("1,200") === 1200);
check("thousands and decimals together", quantity("1.200,5") === 1200.5 && quantity("1,200.5") === 1200.5, [quantity("1.200,5"), quantity("1,200.5")]);
check("text is not a quantity", quantity("12 pcs") === null && quantity("?") === null && quantity("") === null && quantity("-") === null);

const rows = (...r: [string, string, string?][]): NoteRow[] => r.map(([item, delivered, description = ""]) => ({ item, delivered, description }));

const dup = duplicateItems(rows(["AB-100", "2"], ["ab 100", "3"], ["CD-200", "1"], ["", "4"], ["", "5"]));
check("the same item number is found twice, whatever the dashes and capitals", dup.size === 1 && dup.has("AB100"), [...dup]);
check("lines without an item number are not duplicates of each other", !dup.has(""));

const merged = mergeDuplicates(rows(["AB-100", "2", "Bolt"], ["CD-200", "1"], ["ab 100", "3", ""], ["EF-300", "x"], ["EF-300", "4"]));
check("two lines of one item are added up", merged.length === 4 && merged[0].delivered === "5" && merged[0].description === "Bolt", merged);
check("the other lines keep their place", merged[1].item === "CD-200" && merged[1].delivered === "1", merged);
check("a line whose quantity is not a number is left alone", merged.filter((r) => r.item === "EF-300").length === 2, merged);
check("decimals add up without float noise", mergeDuplicates(rows(["A1", "0,1"], ["A1", "0,2"]))[0].delivered === "0.3", mergeDuplicates(rows(["A1", "0,1"], ["A1", "0,2"])));
check("merging nothing gives nothing", mergeDuplicates([]).length === 0);

if (failures) {
  console.log(`\n${failures} failed`);
  process.exit(1);
}
console.log("\nAll checks passed");
