// A stand-in for the AI service, for testing the delivery note table without spending money or needing the key.
//   node scripts/fake-ai.mjs            (listens on 3999)
//   ANTHROPIC_API_KEY=test ANTHROPIC_API_URL=http://localhost:3999/v1/messages npx next start -p 3222
// What it answers depends on the first characters of the image data the route forwards, so a test can pick
// the case it wants by sending an image that starts with that word.
import { createServer } from "node:http";

const tool = (input) => ({ content: [{ type: "tool_use", name: "report_note_table", input }] });

const cases = {
  OKROWS: () => ({
    status: 200,
    body: tool({
      legible: true,
      rows: [
        { item_number: " AB-100 ", delivered: "12", description: "Bolt  M8   zinc" },
        { item_number: "CD-200", delivered: "1.200,5", description: "" },
        { item_number: "", delivered: "4", description: "No article number" },
        { item_number: "", delivered: "", description: "just a heading" }, // nothing to use: dropped
        { item_number: "EF-300", delivered: "2 pcs", description: "Washer" },
        { item_number: "AB-100", delivered: "3", description: "Bolt again" },
      ],
      supplier: "Acme Freight AB",
      note_number: "LS-5521",
      comment: "A delivery note with six lines.",
    }),
  }),
  PAGETWO: () => ({ status: 200, body: tool({ legible: true, rows: [{ item_number: "GH-400", delivered: "9", description: "Nut" }], comment: "Second page." }) }),
  ILLEGIB: () => ({ status: 200, body: tool({ legible: false, rows: [], comment: "This is a photo of a cat." }) }),
  AUTH401: () => ({ status: 401, body: { error: { type: "authentication_error", message: "bad key" } } }),
  BUSY429: () => ({ status: 429, body: { error: { type: "rate_limit_error", message: "slow down" } } }),
  NOTOOL_: () => ({ status: 200, body: { content: [{ type: "text", text: "I could not do that" }] } }),
};

createServer((req, res) => {
  let raw = "";
  req.on("data", (c) => (raw += c));
  req.on("end", () => {
    let word = "OKROWS";
    try {
      const m = JSON.parse(raw);
      const img = m.messages?.[0]?.content?.find((c) => c.type === "image")?.source?.data ?? "";
      const asked = m.tools?.[0]?.name === "report_note_table" && m.system?.includes("DELIVERED");
      if (!asked) word = "NOTOOL_";
      else word = Object.keys(cases).find((k) => img.startsWith(k)) ?? "OKROWS";
    } catch {}
    const { status, body } = cases[word]();
    res.writeHead(status, { "content-type": "application/json" });
    res.end(JSON.stringify(body));
  });
}).listen(3999, () => console.log("fake AI on 3999"));
