// Run: npx tsx scripts/test-counter-note.ts
import { cleanIds, compareSets, expandRange } from "../lib/counter-note";

let failures = 0;
const check = (name: string, ok: boolean, extra?: unknown) => {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${ok ? "" : "  " + JSON.stringify(extra)}`);
  if (!ok) failures++;
};

const r = expandRange("JJD0146000012345001", "JJD0146000012345004");
check("a range of letters and digits expands", r.join() === "JJD0146000012345001,JJD0146000012345002,JJD0146000012345003,JJD0146000012345004", r);
check("a range of plain digits expands, keeping leading zeros", expandRange("373500123456789008", "373500123456789011").length === 4);
check("a range across the 99/100 boundary", expandRange("AB0098", "AB0101").join() === "AB0098,AB0099,AB0100,AB0101");
check("different lengths give nothing", expandRange("AB001", "AB0002").length === 0);
check("a reversed range gives nothing", expandRange("AB0010", "AB0005").length === 0);
check("a huge range is refused", expandRange("AB0000", "AB9999").length === 0);
check("different starts give nothing", expandRange("AB0001", "CD0004").length === 0);

check("cleaning removes spaces, case and duplicates", cleanIds(["ab 12-3456", "AB123456", "x"]).join() === "AB123456");

const scanned = ["A0001", "A0002", "A0003", "A0004"];
let c = compareSets(["A0001", "A0002", "A0003", "A0004"], scanned);
check("everything matches", c.matched.length === 4 && !c.missing.length && !c.extra.length && !c.possible.length, c);
c = compareSets(["A0001", "A0002", "A0003", "A0004", "A0005"], scanned);
check("a package on the note but not scanned is missing", c.missing.join() === "A0005" && c.matched.length === 4, c);
c = compareSets(["A0001", "A0002", "A0003"], scanned);
check("a scanned package not on the note is extra", c.extra.join() === "A0004", c);
c = compareSets(["A0001", "A0002", "A0003", "A0094"], scanned);
check("one character off is a possible misread, not missing and extra", c.possible.length === 1 && c.possible[0].note === "A0094" && c.possible[0].scanned === "A0004" && !c.missing.length && !c.extra.length, c);
c = compareSets(["A0001", "A0002", "B0009"], ["A0001", "A0002", "C7777"]);
check("two unrelated IDs stay missing and extra", c.missing.join() === "B0009" && c.extra.join() === "C7777" && !c.possible.length, c);

if (failures) {
  console.log(`\n${failures} check(s) failed`);
  process.exit(1);
}
console.log("\nAll checks passed");
