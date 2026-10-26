// End-to-end test of the Android app's API against a running server.
//   BASE_URL=http://localhost:3222 ADMIN_EMAIL=... ADMIN_PASSWORD=... MONITOR_EMAIL=... MONITOR_PASSWORD=... \
//     node scripts/test-mobile-api.mjs
// It creates two throwaway users and removes everything it made at the end.
const BASE = process.env.BASE_URL ?? "http://localhost:3222";
const need = (k) => process.env[k] ?? (console.error(`Set ${k}`), process.exit(2));
const ADMIN = { email: need("ADMIN_EMAIL"), password: need("ADMIN_PASSWORD") };
const MONITOR = { email: need("MONITOR_EMAIL"), password: need("MONITOR_PASSWORD") };
const stamp = Date.now().toString(36);
const rand = () => Math.random().toString(36).slice(2, 10) + "-Aa1";
const CLIENT = { email: `qa-api-${stamp}@example.com`, password: rand() };
const NEW_PASSWORD = rand();
const NUMBER_A = String(Math.floor(1e9 + Math.random() * 9e9));
const NUMBER_B = String(Math.floor(1e9 + Math.random() * 9e9));

let failures = 0;
const check = (name, ok, extra) => {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${ok ? "" : "  " + JSON.stringify(extra)}`);
  if (!ok) failures++;
};

async function call(method, path, token, body) {
  const res = await fetch(BASE + path, {
    method,
    headers: { "content-type": "application/json", ...(token ? { authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  let json = null;
  try {
    json = await res.json();
  } catch {}
  return { status: res.status, body: json };
}

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

// --- sign in -----------------------------------------------------------------
const bad = await call("POST", "/api/mobile/login", null, { email: ADMIN.email, password: "definitely-wrong" });
check("wrong password is refused (401)", bad.status === 401 && !!bad.body?.error, bad);

const adminLogin = await call("POST", "/api/mobile/login", null, ADMIN);
check("admin signs in and gets a token", adminLogin.status === 200 && typeof adminLogin.body?.token === "string", adminLogin);
const admin = adminLogin.body?.token;
check("admin has administrator access", adminLogin.body?.user?.isAdmin === true && adminLogin.body.user.perms.includes("manage_requests"), adminLogin.body);

const noToken = await call("GET", "/api/mobile/me", null);
check("no token is refused (401)", noToken.status === 401, noToken);
const junk = await call("GET", "/api/mobile/me", "not.a.token");
check("a bad token is refused (401)", junk.status === 401, junk);
const me = await call("GET", "/api/mobile/me", admin);
check("/me returns the signed-in user", me.status === 200 && me.body?.user?.email === ADMIN.email, me);

// --- create a client: forced password change ----------------------------------
const created = await call("POST", "/api/mobile/users/create", admin, { email: CLIENT.email, password: CLIENT.password, perms: ["request"] });
check("admin creates a client", created.status === 200 && created.body?.ok === true, created);

const noPerms = await call("POST", "/api/mobile/users/create", admin, { email: `x-${stamp}@example.com`, password: "Whatever-1234", perms: [] });
check("creating a user with no permission is refused", noPerms.status === 400, noPerms);

const clientLogin = await call("POST", "/api/mobile/login", null, CLIENT);
check("new client signs in and must change the password", clientLogin.status === 200 && clientLogin.body?.user?.mustChange === true, clientLogin);
let client = clientLogin.body?.token;
const blocked = await call("GET", "/api/mobile/client", client);
check("a pending password change blocks the app screens (403)", blocked.status === 403 && blocked.body?.code === "password_change_required", blocked);

const shortPw = await call("POST", "/api/mobile/password", client, { current: CLIENT.password, next: "short", confirm: "short" });
check("a too-short new password is refused", shortPw.status === 400, shortPw);
const wrongCurrent = await call("POST", "/api/mobile/password", client, { current: "nope-nope-nope", next: NEW_PASSWORD, confirm: NEW_PASSWORD });
check("a wrong current password is refused", wrongCurrent.status === 400, wrongCurrent);
const changed = await call("POST", "/api/mobile/password", client, { current: CLIENT.password, next: NEW_PASSWORD, confirm: NEW_PASSWORD });
check("the client changes their password and gets a fresh token", changed.status === 200 && !!changed.body?.token && changed.body.user.mustChange === false, changed);
const oldToken = await call("GET", "/api/mobile/me", client);
check("the old token stops working after the change (401)", oldToken.status === 401, oldToken);
client = changed.body?.token;

// --- client screen and requests -----------------------------------------------
const empty = await call("GET", "/api/mobile/client", client);
check("client screen starts empty", empty.status === 200 && empty.body?.status === "none" && empty.body.history.length === 0, empty);

const invalid = await call("POST", "/api/mobile/request", client, { code: "12345" });
check("an invalid number is refused", invalid.status === 400, invalid);
const reqA = await call("POST", "/api/mobile/request", client, { code: NUMBER_A, supplier: "Acme Freight", colli: 12 });
check("client requests a code", reqA.status === 200 && reqA.body?.ok === true, reqA);
const waiting = await call("GET", "/api/mobile/client", client);
check("client sees 'waiting'", waiting.body?.status === "waiting", waiting);

const clientAdmin = await call("GET", "/api/mobile/admin", client);
check("a client cannot open the admin screen (403)", clientAdmin.status === 403, clientAdmin);
const clientUsers = await call("GET", "/api/mobile/users", client);
check("a client cannot open the users screen (403)", clientUsers.status === 403, clientUsers);
const clientLookup = await call("POST", "/api/mobile/lookup", client, { code: NUMBER_A });
check("a client cannot use the monitor (403)", clientLookup.status === 403, clientLookup);

// --- admin handles the requests ------------------------------------------------
await wait(1500); // notifications are sent after the response
const reqB = await call("POST", "/api/mobile/request", client, { code: NUMBER_B });
check("client requests a second code", reqB.status === 200, reqB);

const adminView = await call("GET", "/api/mobile/admin", admin);
const pendingA = adminView.body?.pending?.find((p) => p.number === NUMBER_A);
const pendingB = adminView.body?.pending?.find((p) => p.number === NUMBER_B);
check("admin sees both requests with their numbers", !!pendingA && !!pendingB && pendingA.askedBy === CLIENT.email, adminView.body?.pending);
check("the note comes through", pendingA?.note === "Acme Freight · 12 colli", pendingA);

const issue = await call("POST", "/api/mobile/admin/issue", admin, { id: pendingA?.id });
check("admin issues a code", issue.status === 200, issue);
const deny = await call("POST", "/api/mobile/admin/deny", admin, { id: pendingB?.id });
check("admin denies the other request", deny.status === 200 && deny.body?.ok === true, deny);

const ready = await call("GET", "/api/mobile/client", client);
check("client sees the issued code", ready.body?.history?.length === 1 && /^[A-Z]\d{5}$/.test(ready.body.history[0].vcode), ready.body);
const code = ready.body?.history?.[0]?.vcode;

// --- monitor --------------------------------------------------------------------
const monitorLogin = await call("POST", "/api/mobile/login", null, MONITOR);
const monitor = monitorLogin.body?.token;
check("monitor signs in", monitorLogin.status === 200 && !!monitor, monitorLogin);
const found = await call("POST", "/api/mobile/lookup", monitor, { code: NUMBER_A });
check("monitor finds the issued code", found.status === 200 && found.body?.vcode === code, found);
const missing = await call("POST", "/api/mobile/lookup", monitor, { code: NUMBER_B });
check("monitor gets 404 for a denied number", missing.status === 404 && missing.body?.code === "not_issued", missing);
const monitorAdmin = await call("GET", "/api/mobile/admin", monitor);
check("monitor cannot open the admin screen (403)", monitorAdmin.status === 403, monitorAdmin);

// --- notifications ---------------------------------------------------------------
await wait(1500);
const feed = await call("GET", "/api/mobile/notifications?list=1", client);
const kinds = (feed.body?.items ?? []).map((i) => i.kind);
check("client was notified: code issued and request denied", kinds.includes("code_issued") && kinds.includes("request_denied"), kinds);
check("notifications never contain the code", !JSON.stringify(feed.body).includes(code), feed.body);
check("unread count is reported", feed.body?.unread >= 2, feed.body);
const since = await call("GET", `/api/mobile/notifications?after=${feed.body.latestId}`, client);
check("polling after the newest id returns nothing new", since.status === 200 && since.body.items.length === 0, since);
await call("POST", "/api/mobile/notifications/read", client);
const afterRead = await call("GET", "/api/mobile/notifications?list=1", client);
check("marking as read clears the unread count", afterRead.body?.unread === 0, afterRead.body);

// --- remove the issued request ------------------------------------------------------
const issuedRow = (await call("GET", "/api/mobile/admin", admin)).body?.issued?.find((i) => i.vcode === code);
check("issued list shows who asked and who issued", issuedRow?.askedBy === CLIENT.email && !!issuedRow?.issuedBy, issuedRow);
const removed = await call("POST", "/api/mobile/admin/remove", admin, { id: issuedRow?.id });
check("admin removes the issued request", removed.status === 200, removed);
const gone = await call("POST", "/api/mobile/lookup", monitor, { code: NUMBER_A });
check("its code stops working on the monitor (404)", gone.status === 404, gone);

// --- users ----------------------------------------------------------------------------
const list = await call("GET", "/api/mobile/users", admin);
const mine = list.body?.users?.find((u) => u.email === CLIENT.email);
check("admin lists users with the actions allowed on each", !!mine && mine.canDelete && mine.canReset && mine.canEdit, mine);
check("the admin's own row cannot be deleted", list.body?.users?.find((u) => u.isSelf)?.canDelete === false, list.body?.users?.find((u) => u.isSelf));

const edit = await call("POST", "/api/mobile/users/update", admin, { id: mine?.id, email: CLIENT.email, perms: ["request", "monitor"] });
check("admin changes a user's permissions", edit.status === 200, edit);
const nowMonitor = await call("POST", "/api/mobile/lookup", client, { code: NUMBER_A });
check("the new permission applies at once", nowMonitor.status === 404, nowMonitor); // allowed to look up now (not issued)

const reset = await call("POST", "/api/mobile/users/reset", admin, { id: mine?.id });
check("admin resets the password and gets a temporary one", reset.status === 200 && typeof reset.body?.code === "string", reset);
const signedOut = await call("GET", "/api/mobile/me", client);
check("the reset signs the user out everywhere (401)", signedOut.status === 401, signedOut);

const forgot = await call("POST", "/api/mobile/forgot", null, { email: `nobody-${stamp}@example.com` });
check("forgot password answers the same for an unknown email", forgot.status === 200 && forgot.body?.ok === true, forgot);

const clientTriesUpdate = await call("POST", "/api/mobile/users/update", monitor, { id: mine?.id, email: "x@example.com", perms: ["request"] });
check("a non-admin cannot edit users (403)", clientTriesUpdate.status === 403, clientTriesUpdate);

// --- clean up ---------------------------------------------------------------------------
const del = await call("POST", "/api/mobile/users/delete", admin, { id: mine?.id });
check("admin deletes the test user", del.status === 200, del);
const selfDelete = await call("POST", "/api/mobile/users/delete", admin, { id: list.body?.users?.find((u) => u.isSelf)?.id });
check("an admin cannot delete themselves", selfDelete.status === 400, selfDelete);

console.log(failures === 0 ? "\nAll checks passed." : `\n${failures} check(s) failed.`);
process.exit(failures === 0 ? 0 : 1);
