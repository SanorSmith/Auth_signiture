// Run: npx tsx scripts/test-counter-note.ts
import { cleanIds, compareDeliveries, compareSets, expandRange } from "../lib/counter-note";
import { ruleForCodes } from "../lib/counter-match";

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

// A note that lists packages of several deliveries.
const A = (n: number) => `1111AAAA0${String(n).padStart(4, "0")}`;
const B = (n: number) => `2222BBBB0${String(n).padStart(4, "0")}`;
const C = (n: number) => `3333CCCC0${String(n).padStart(4, "0")}`;
const deliveries = [
  { id: 1, number: 1, codes: [A(1), A(2), A(3)], rule: null },
  { id: 2, number: 2, codes: [B(1), B(2)], rule: { len: A(1).length, prefix: 9 } },
];
let g = compareDeliveries([A(1), A(2), A(3), A(4), B(1), B(2)], deliveries);
check("each number on the note goes to its own delivery", g.deliveries[0].comparison.matched.length === 3 && g.deliveries[1].comparison.matched.length === 2, g);
check("a package missing from one delivery is reported for that delivery only", g.deliveries[0].comparison.missing.join() === A(4) && g.deliveries[1].comparison.missing.length === 0, g.deliveries.map((d) => d.comparison.missing));
check("nothing is reported as extra because of the other delivery", g.deliveries.every((d) => d.comparison.extra.length === 0));
g = compareDeliveries([A(1), A(2), A(3), B(1), B(2), C(1), C(2), C(3)], deliveries);
check("numbers of a delivery that was not scanned form their own group", g.unscanned.length === 1 && g.unscanned[0].length === 3, g.unscanned);
g = compareDeliveries([A(1), A(2)], deliveries);
check("a delivery with nothing on the note shows its packages as extra", g.deliveries[1].comparison.extra.length === 2 && g.deliveries[0].comparison.extra.join() === A(3), g.deliveries.map((d) => d.comparison.extra));

check("one rule for merged codes keeps the shared beginning", ruleForCodes([A(1), A(2), A(7)])?.prefix === A(1).length - 3, ruleForCodes([A(1), A(2), A(7)]));
check("merged codes of different lengths have no rule", ruleForCodes([A(1), "ABCDEFGH"]) === null);

// A scanner reads the pallet label as "00" + the 18-digit SSCC; the note prints the 18 digits.
const S = (n: number) => `373217102325${String(n).padStart(6, "0")}`;
let w = compareSets([S(256285), S(257282), S(257312)], ["00" + S(256285), "00" + S(257282), "00" + S(999999)]);
check("a scan with the 00 prefix matches the note's 18 digits", w.matched.length === 2 && w.missing.join() === S(257312) && w.extra.join() === "00" + S(999999), w);
w = compareSets(["00" + S(1), S(2)], [S(1), "00" + S(2)]);
check("and the other way round", w.matched.length === 2 && w.missing.length === 0 && w.extra.length === 0, w);
w = compareSets([S(257312)], ["00" + S(257313)]);
check("a misread digit is still found with the prefix", w.possible.length === 1 && w.missing.length === 0, w);

if (failures) {
  console.log(`\n${failures} check(s) failed`);
  process.exit(1);
}
console.log("\nAll checks passed");
