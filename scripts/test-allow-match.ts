// Unit tests for matching a request's supplier name against the allow list. Run: npx tsx scripts/test-allow-match.ts
import { allowedBy, nameWords } from "../lib/allow-list";

let failures = 0;
const check = (name: string, ok: boolean, extra?: unknown) => {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${ok ? "" : "  " + JSON.stringify(extra)}`);
  if (!ok) failures++;
};

const list = ["Acme", "Döner Helmer GmbH", "Nordic Parts"];

check("the same name matches", allowedBy("Acme", list) === "Acme");
check("one word of a longer name matches", allowedBy("Acme Freight AB", list) === "Acme");
check("the word can be anywhere in the name", allowedBy("The Real Acme", list) === "Acme");
check("capital letters do not matter", allowedBy("aCmE logistics", list) === "Acme");
check("punctuation does not split a match away", allowedBy("Acme, Inc.", list) === "Acme" && allowedBy("Döner+Helmer", list) === "Döner Helmer GmbH");
check("one word of a longer list name matches", allowedBy("Helmer Transport", list) === "Döner Helmer GmbH");
check("swedish letters match", allowedBy("DÖNER foods", list) === "Döner Helmer GmbH");
check("only a part of a word does not match", allowedBy("Acmeville Freight", list) === null && allowedBy("Nordics", list) === null);
check("a different supplier does not match", allowedBy("Beta Tools", list) === null && allowedBy("Beta Parts", list) === "Nordic Parts");
check("a shared company form alone does not match", allowedBy("Foo AB", ["Bar AB"]) === null && allowedBy("Foo GmbH", list) === null);
check("an empty name never matches", allowedBy("", list) === null && allowedBy("   ", list) === null);
check("an empty list matches nothing", allowedBy("Acme", []) === null);
check("a list name that is only a company form must be the same", allowedBy("AB", ["AB"]) === "AB" && allowedBy("Foo AB", ["AB"]) === null);
check("words are letters and digits of two or more, without company forms", nameWords("A & B Acme-2 AB").join() === "acme", nameWords("A & B Acme-2 AB"));

if (failures) {
  console.log(`\n${failures} failed`);
  process.exit(1);
}
console.log("\nAll checks passed");
