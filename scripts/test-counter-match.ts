// Run: npx tsx scripts/test-counter-match.ts
// Checks the shipment rule on made-up IDs shaped like real carrier numbers. Replace or extend the
// samples with real labels to see where it wrongly joins or splits shipments.
import { adjustRule, fits, learnRule, normalizeCode } from "../lib/counter-match";

let failures = 0;
const check = (name: string, ok: boolean, extra?: unknown) => {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${ok ? "" : "  " + JSON.stringify(extra)}`);
  if (!ok) failures++;
};

// Counts how a list of scans would be sorted: the first is the reference, the second teaches the rule.
function run(ids: string[]) {
  const codes = ids.map((i) => normalizeCode(i)!);
  const reference = codes[0];
  let rule = null as ReturnType<typeof learnRule>;
  const counted = [reference];
  const refused: string[] = [];
  for (const code of codes.slice(1)) {
    if (counted.includes(code)) continue;
    if (!rule) {
      rule = learnRule(reference, code);
      if (rule) counted.push(code);
      else refused.push(code);
    } else if (fits(rule, reference, code)) counted.push(code);
    else refused.push(code);
  }
  return { counted, refused, rule };
}

// An SSCC-like 18-digit shipment: same prefix, the last digits count up.
const sscc = (n: number) => `37350012345678${String(n).padStart(4, "0")}`;
let r = run([sscc(10), sscc(11), sscc(12), sscc(19), sscc(20), sscc(21), sscc(99), sscc(100), sscc(101)]);
check("an 18-digit shipment is counted whole, also across 99 to 100", r.counted.length === 9 && r.refused.length === 0, r);

r = run([sscc(10), sscc(11), "373500123456790015", sscc(12)]);
check("a package from another shipment is refused", r.refused.length === 1 && r.refused[0] === "373500123456790015" && r.counted.length === 3, r);

// DHL piece IDs: letters then digits.
const jd = (n: number) => `JJD01460000123456${String(n).padStart(3, "0")}`;
r = run([jd(1), jd(2), jd(3), "JJD01460000999999001", jd(4)]);
check("letters and digits work, a different shipment is refused", r.counted.length === 4 && r.refused.length === 1, r);

r = run(["1234567890", "1234567891", "1234567892"]);
check("10-digit numbers: only the last 3 may vary", r.counted.length === 3 && r.rule?.prefix === 7, r);

r = run(["1234567890", "55555555"]);
check("a different length is refused and teaches nothing", r.counted.length === 1 && r.rule === null, r);

r = run(["1234567890", "9876543210"]);
check("two unrelated IDs of the same length are refused", r.counted.length === 1 && r.refused.length === 1, r);

check("spaces, dashes and brackets are ignored", normalizeCode("(00) 3735-0012 3456") === "00373500123456", normalizeCode("(00) 3735-0012 3456"));
check("too short is invalid", normalizeCode("123") === null);
check("empty is invalid", normalizeCode("   ") === null);
check("lower case is read as upper case", normalizeCode("jjd0146") === "JJD0146");

const rule = learnRule(sscc(10), sscc(11))!;
check("the rule can be narrowed and widened", adjustRule(rule, -2).prefix === rule.prefix - 2 && adjustRule(rule, 50).prefix === rule.len - 1 && adjustRule(rule, -50).prefix === 1, rule);

if (failures) {
  console.log(`\n${failures} check(s) failed`);
  process.exit(1);
}
console.log("\nAll checks passed");
