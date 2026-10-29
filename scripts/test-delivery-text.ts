// Run: npx tsx scripts/test-delivery-text.ts
import { deliveryNote } from "../lib/codes";
import { translate } from "../lib/i18n";

let failures = 0;
const check = (name: string, ok: boolean, extra?: unknown) => {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${ok ? "" : "  " + JSON.stringify(extra)}`);
  if (!ok) failures++;
};
const note = (r: ReturnType<typeof deliveryNote>) => ("note" in r ? r.note : `ERROR: ${r.error}`);

check("one type", note(deliveryNote("Acme", { Pallet: "3" })) === "Acme · 3 Pallet");
check("a mixed delivery lists each type that has a number", note(deliveryNote("Acme", { Pallet: "2", Bundle: "", Box: "6" })) === "Acme · 2 Pallet · 6 Box");
check("all three", note(deliveryNote("Acme", { Pallet: "1", Bundle: "20", Box: "300" })) === "Acme · 1 Pallet · 20 Bundle · 300 Box");
check("zero is the same as empty", note(deliveryNote("Acme", { Pallet: "0", Box: "4" })) === "Acme · 4 Box");
check("nothing entered is refused", note(deliveryNote("Acme", {})) === "ERROR: Enter how many pallets, bundles or boxes");
check("a number over 999 is refused", note(deliveryNote("Acme", { Pallet: "1000" })).startsWith("ERROR: Each number"));
check("letters are refused", note(deliveryNote("Acme", { Pallet: "ab" })).startsWith("ERROR: Each number"));
check("a short supplier name is refused", note(deliveryNote("A", { Pallet: "1" })) === "ERROR: Enter the supplier name");
check("the longest possible text fits in 80 characters", note(deliveryNote("x".repeat(36), { Pallet: "999", Bundle: "999", Box: "999" })).length <= 80);
// older apps
check("an older app (number and type) still works", note(deliveryNote("Acme", {}, { colli: "12", type: "Pallet" })) === "Acme · 12 Pallet");
check("and its Carton is a Box", note(deliveryNote("Acme", {}, { colli: "5", type: "Carton" })) === "Acme · 5 Box");
check("a type that does not exist is refused", note(deliveryNote("Acme", {}, { colli: "5", type: "Drum" })).startsWith("ERROR"));
check("the new fields win over the old ones", note(deliveryNote("Acme", { Box: "2" }, { colli: "9", type: "Pallet" })) === "Acme · 2 Box");

check("Swedish: the types are translated", translate("sv", "Acme · 2 Pallet · 6 Box") === "Acme · 2 Pall · 6 Kartong", translate("sv", "Acme · 2 Pallet · 6 Box"));
check("Swedish: all three", translate("sv", "Acme · 1 Pallet · 20 Bundle · 300 Box") === "Acme · 1 Pall · 20 Bunt · 300 Kartong");
check("English stays as it is", translate("en", "Acme · 2 Pallet · 6 Box") === "Acme · 2 Pallet · 6 Box");
check("an old request still reads in Swedish", translate("sv", "Acme · 12 colli · Pallet") === "Acme · 12 kolli · Pall");

if (failures) {
  console.log(`\n${failures} check(s) failed`);
  process.exit(1);
}
console.log("\nAll checks passed");
