// Swedish and English. The English text is the key: t("Sign in") returns the Swedish text when the
// language is Swedish and the English text otherwise, so a missing translation never breaks a screen.

export type Lang = "en" | "sv";
export const LANGS: Lang[] = ["sv", "en"];
export const LANG_COOKIE = "lang";

export const isLang = (v: unknown): v is Lang => v === "sv" || v === "en";

// Swedish speakers get Swedish; everyone else English, until someone picks a language.
export function langFromHeader(accept: string | null | undefined): Lang {
  const first = (accept ?? "").split(",")[0]?.trim().toLowerCase() ?? "";
  return first.startsWith("sv") ? "sv" : "en";
}

const SV: Record<string, string> = {
  // Navigation and frame
  Home: "Hem",
  Requests: "Begäranden",
  Scan: "Skanna",
  Monitor: "Kontroll",
  Users: "Användare",
  Account: "Konto",
  "Log out": "Logga ut",
  "Password reset requests waiting": "Begäran om nytt lösenord väntar",
  "Verification codes for scanned client numbers": "Verifieringskoder för skannade kundnummer",
  Language: "Språk",

  // Sign in
  "Sign in": "Logga in",
  "Use the account your admin gave you.": "Använd kontot som din administratör gav dig.",
  Email: "E-post",
  Password: "Lösenord",
  "Forgot password?": "Glömt lösenordet?",
  "Your password": "Ditt lösenord",
  "Signing in…": "Loggar in…",
  "Forgot password": "Glömt lösenordet",
  "Enter your email. The admin is notified and will give you a temporary password.":
    "Ange din e-postadress. Administratören meddelas och ger dig ett tillfälligt lösenord.",
  "Sending…": "Skickar…",
  "Notify the admin": "Meddela administratören",
  "Back to sign in": "Tillbaka till inloggningen",
  "Hide password": "Dölj lösenordet",
  "Show password": "Visa lösenordet",
  Hide: "Dölj",
  Show: "Visa",

  // Account
  "Change the password you use to sign in.": "Byt lösenordet du loggar in med.",
  "You need to choose a new password before you can continue.": "Du måste välja ett nytt lösenord innan du kan fortsätta.",
  "Change password": "Byt lösenord",
  "Current password": "Nuvarande lösenord",
  "New password": "Nytt lösenord",
  "Repeat new password": "Upprepa nytt lösenord",
  "At least 8 characters": "Minst 8 tecken",
  "Saving…": "Sparar…",

  // Scan and request
  "Request a code": "Begär en kod",
  "Scan the 10-digit number to get its verification code.": "Skanna det 10-siffriga numret för att få dess verifieringskod.",
  "Supplier name": "Leverantörens namn",
  "Who delivers?": "Vem levererar?",
  "Number of colli": "Antal kolli",
  "How many packages?": "Hur många kollin?",
  "Colli type": "Kollityp",
  "Pallet, box, carton…": "Pall, låda, kartong…",
  Pallet: "Pall",
  Box: "Låda",
  Carton: "Kartong",
  Bag: "Säck",
  Crate: "Back",
  Roll: "Rulle",
  Drum: "Fat",
  "Send request": "Skicka begäran",
  "10-digit number": "10-siffrigt nummer",
  "Scan the number": "Skanna numret",
  "Type with keyboard": "Skriv med tangentbord",
  "Hide keyboard": "Dölj tangentbordet",
  "No code yet. Scan a number to get started.": "Ingen kod ännu. Skanna ett nummer för att börja.",
  "Request denied": "Begäran nekades",
  "The admin denied this request. Scan the number again to ask once more.":
    "Administratören nekade begäran. Skanna numret igen för att begära på nytt.",
  "Waiting for the admin…": "Väntar på administratören…",
  "Your verification code": "Din verifieringskod",
  "Last 1 verified code": "Senaste verifierade koden",
  "Last 2 verified codes": "Senaste 2 verifierade koderna",
  "Last 3 verified codes": "Senaste 3 verifierade koderna",

  // Monitor
  "Scan or type a 10-digit number to show its verification code.": "Skanna eller skriv ett 10-siffrigt nummer för att visa dess verifieringskod.",
  "Show code": "Visa kod",
  "Looking up…": "Slår upp…",
  "Verification code": "Verifieringskod",
  "Not available": "Inte tillgänglig",
  "Ready. Waiting for a scan…": "Redo. Väntar på en skanning…",

  // Requests (admin)
  "Issue verification codes for the numbers clients have scanned.": "Utfärda verifieringskoder för de nummer som kunder har skannat.",
  "Number not stored": "Numret är inte sparat",
  Pending: "Väntar",
  "Codes issued": "Utfärdade koder",
  "Reset requests": "Lösenordsbegäran",
  "Asked by": "Begärd av",
  "Code issued by": "Koden utfärdades av",
  "Issued by": "Utfärdad av",
  Delivery: "Leverans",
  "No delivery details.": "Inga leveransuppgifter.",
  Unknown: "Okänd",
  "Pending requests": "Väntande begäranden",
  "Nothing waiting. New scans appear here.": "Inget väntar. Nya skanningar visas här.",
  "Last 3 issued": "Senaste 3 utfärdade",
  "Nothing issued yet.": "Inget utfärdat ännu.",
  "Open Users": "Öppna Användare",
  "1 password reset request waiting.": "1 begäran om nytt lösenord väntar.",
  Deny: "Neka",
  Generate: "Skapa kod",
  "Deny this request?": "Neka denna begäran?",
  "Yes, deny": "Ja, neka",
  "Denying…": "Nekar…",
  Cancel: "Avbryt",
  Remove: "Ta bort",
  "Remove this request? Its code stops working on the monitor.": "Ta bort denna begäran? Dess kod slutar fungera i kontrollen.",
  "Yes, remove": "Ja, ta bort",
  "Removing…": "Tar bort…",

  // Users
  "Create accounts and choose what each person may do.": "Skapa konton och välj vad varje person får göra.",
  "All users": "Alla användare",
  "Add user": "Lägg till användare",
  "They choose their own password when they first sign in.": "De väljer sitt eget lösenord när de loggar in första gången.",
  "Initial password": "Första lösenord",
  "Creating…": "Skapar…",
  "Create user": "Skapa användare",
  Administrator: "Administratör",
  "No access": "Ingen behörighet",
  "Reset requested": "Nytt lösenord begärt",
  Created: "Skapad",
  You: "Du",
  Save: "Spara",
  Edit: "Ändra",
  "Resetting…": "Återställer…",
  "Reset password": "Återställ lösenord",
  Delete: "Ta bort",
  "Delete this user?": "Ta bort denna användare?",
  "Yes, delete": "Ja, ta bort",
  Copy: "Kopiera",
  "Give this to the user. They must choose a new password when they sign in.":
    "Ge detta till användaren. De måste välja ett nytt lösenord när de loggar in.",
  Permissions: "Behörigheter",
  "Full access, including editing permissions": "Full åtkomst, inklusive att ändra behörigheter",
  "Request codes": "Begära koder",
  "Scan numbers and see their codes": "Skanna nummer och se deras koder",
  "Look up a code by scanning its number": "Slå upp en kod genom att skanna dess nummer",
  "Manage requests": "Hantera begäranden",
  "Generate, deny and remove requests": "Skapa koder samt neka och ta bort begäranden",
  "Create accounts": "Skapa konton",
  "Add new users": "Lägg till nya användare",
  "Reset passwords": "Återställa lösenord",
  "Not for administrators or other user managers": "Gäller inte administratörer eller andra användarhanterare",
  "Remove accounts": "Ta bort konton",

  // Notifications
  Notifications: "Notiser",
  Close: "Stäng",
  "Nothing yet. New activity shows up here.": "Inget ännu. Ny aktivitet visas här.",
  "Show fewer": "Visa färre",
  "Play sounds": "Spela ljud",
  "A different tone for each notification and action, on this device": "En egen ton för varje notis och handling, på den här enheten",
  "Test sound": "Testa ljud",
  "Sound is blocked. Tap anywhere on the page once, then press Test sound. If you still hear nothing, turn up the phone's media volume and check it is not on silent.":
    "Ljudet är blockerat. Tryck en gång var som helst på sidan och tryck sedan på Testa ljud. Hörs fortfarande inget: höj telefonens mediavolym och kontrollera att den inte är på ljudlöst.",
  "Hear the tones": "Lyssna på tonerna",
  "Your own actions": "Dina egna handlingar",
  "Device notifications": "Enhetsnotiser",
  "Alerts on this device even when the app is closed, using the device's own notification sound.":
    "Aviseringar på den här enheten även när appen är stängd, med enhetens egen notisljud.",
  "Not available in this browser. Install the app on an Android phone to use it.": "Finns inte i den här webbläsaren. Installera appen på en Android-telefon för att använda det.",
  "Notifications are blocked for this site. Allow them in the browser's site settings.": "Notiser är blockerade för den här sidan. Tillåt dem i webbläsarens webbplatsinställningar.",
  "Working…": "Arbetar…",
  "Turn on device notifications": "Slå på enhetsnotiser",
  "On for this device": "På för den här enheten",
  "Turn off": "Slå av",
  "Could not turn on device notifications": "Kunde inte slå på enhetsnotiser",
  "Sound is off until you tap. Phones keep it locked until then.": "Ljudet är avstängt tills du trycker. Telefoner håller det låst tills dess.",
  "Enable sound": "Aktivera ljud",
  "Get alerts even when the app is closed": "Få aviseringar även när appen är stängd",
  "Your phone will ring with its own notification sound when something needs you.": "Din telefon ringer med sitt eget notisljud när något behöver dig.",
  "Turn on": "Slå på",
  "Not now": "Inte nu",
  View: "Visa",
  Dismiss: "Avfärda",
  "just now": "nyss",
  Play: "Spela",

  // Tones
  "New request": "Ny begäran",
  "A client asked for a code": "En kund begärde en kod",
  "Password reset": "Nytt lösenord",
  "Someone asked for a password reset": "Någon begärde ett nytt lösenord",
  "Code ready": "Koden är klar",
  "The admin issued your code": "Administratören utfärdade din kod",
  "The admin denied your request": "Administratören nekade din begäran",
  "Request removed": "Begäran borttagen",
  "The admin removed your request": "Administratören tog bort din begäran",
  "Access changed": "Behörighet ändrad",
  "An admin changed what you can do": "En administratör ändrade vad du får göra",
  "Request sent": "Begäran skickad",
  "Your scan went through": "Din skanning gick igenom",
  "Code found": "Kod hittad",
  "The monitor found the code": "Kontrollen hittade koden",
  "Not found": "Hittades inte",
  "No code for that number yet": "Ingen kod för det numret ännu",
  Done: "Klart",
  "An action went through": "En handling gick igenom",
  "Denied or removed": "Nekad eller borttagen",
  "A request or user was denied, removed or deleted": "En begäran eller användare nekades, togs bort eller raderades",
  Error: "Fel",
  "Something was not accepted": "Något godkändes inte",

  // Messages from the server
  "Not a valid 10-digit number": "Inte ett giltigt 10-siffrigt nummer",
  "This number has already been requested": "Det här numret har redan begärts",
  "Request sent again, waiting for the admin": "Begäran skickad igen, väntar på administratören",
  "Request sent, waiting for the admin": "Begäran skickad, väntar på administratören",
  "Already requested, waiting for the admin": "Redan begärd, väntar på administratören",
  "Verification code shown below": "Verifieringskoden visas nedan",
  "Invalid request": "Ogiltig begäran",
  "Request not found": "Begäran hittades inte",
  "This request was already handled": "Den här begäran är redan hanterad",
  Denied: "Nekad",
  Removed: "Borttagen",
  "No verification code issued for this number yet": "Ingen verifieringskod har utfärdats för det här numret ännu",
  "Enter the supplier name": "Ange leverantörens namn",
  "Enter the colli type, for example Pallet or Box": "Ange kollitypen, till exempel Pall eller Låda",
  "Wrong email or password": "Fel e-postadress eller lösenord",
  "Current password is wrong": "Nuvarande lösenord är fel",
  "New password must be at least 8 characters": "Det nya lösenordet måste vara minst 8 tecken",
  "The new passwords don't match": "De nya lösenorden stämmer inte överens",
  "Choose a password you haven't used just now": "Välj ett lösenord du inte nyss använde",
  "Invalid email": "Ogiltig e-postadress",
  "Password must be at least 8 characters": "Lösenordet måste vara minst 8 tecken",
  "Only an administrator can create administrators": "Bara en administratör kan skapa administratörer",
  "Choose at least one permission": "Välj minst en behörighet",
  "You can only give permissions you have yourself": "Du kan bara ge behörigheter som du själv har",
  "Email already exists": "E-postadressen finns redan",
  "Invalid user": "Ogiltig användare",
  "User not found": "Användaren hittades inte",
  "You can't remove your own administrator access": "Du kan inte ta bort din egen administratörsbehörighet",
  "You can't delete your own account": "Du kan inte ta bort ditt eget konto",
  "You can't remove administrators or other user managers": "Du kan inte ta bort administratörer eller andra användarhanterare",
  "You can't reset the password of administrators or other user managers": "Du kan inte återställa lösenordet för administratörer eller andra användarhanterare",
  Saved: "Sparat",
  Deleted: "Borttagen",
  "Temporary password (shown once):": "Tillfälligt lösenord (visas en gång):",
  "If that account exists, the admin has been notified and will give you a temporary password.":
    "Om kontot finns har administratören meddelats och ger dig ett tillfälligt lösenord.",
  "Not signed in": "Inte inloggad",
  "Choose a new password first": "Välj ett nytt lösenord först",
  "Not allowed": "Inte tillåtet",
  "Invalid subscription": "Ogiltig prenumeration",
  "Could not load": "Kunde inte läsa in",

  // Notification texts
  "New verification request": "Ny verifieringsbegäran",
  "Password reset requested": "Nytt lösenord begärt",
  "Your access was changed": "Din behörighet ändrades",
  "An administrator updated what you can do in the app.": "En administratör uppdaterade vad du kan göra i appen.",
  "Your request was denied": "Din begäran nekades",
  "The admin denied your request. Scan the number again to ask once more.": "Administratören nekade din begäran. Skanna numret igen för att begära på nytt.",
  "Your request was removed": "Din begäran togs bort",
  "The admin removed one of your requests.": "Administratören tog bort en av dina begäranden.",
  "Your verification code is ready": "Din verifieringskod är klar",
  "The admin issued the code for your request.": "Administratören utfärdade koden för din begäran.",
};

// Messages with a number or a name in them.
const PATTERNS: [RegExp, (m: RegExpMatchArray) => string][] = [
  [/^Too many attempts\. Try again in (\d+) min\.$/, (m) => `För många försök. Försök igen om ${m[1]} min.`],
  [/^Too many requests\. Try again in (\d+) min\.$/, (m) => `För många förfrågningar. Försök igen om ${m[1]} min.`],
  [/^The supplier name can be at most (\d+) characters$/, (m) => `Leverantörens namn får vara högst ${m[1]} tecken`],
  [/^The colli type can be at most (\d+) characters$/, (m) => `Kollityp får vara högst ${m[1]} tecken`],
  [/^Enter the number of colli, from 1 to (\d+)$/, (m) => `Ange antal kolli, från 1 till ${m[1]}`],
  [/^Created (.+)\. They choose a new password at first login\.$/, (m) => `${m[1]} skapades. De väljer ett nytt lösenord vid första inloggningen.`],
  [/^(.+) asked for a password reset$/, (m) => `${m[1]} bad om ett nytt lösenord`],
  [/^From (.+)$/, (m) => `Från ${m[1]}`],
  [/^(\d+) password reset requests waiting\.$/, (m) => `${m[1]} begäranden om nytt lösenord väntar.`],
  [/^Show all (\d+)$/, (m) => `Visa alla ${m[1]}`],
  [/^(\d+) min ago$/, (m) => `för ${m[1]} min sedan`],
  [/^(\d+) h ago$/, (m) => `för ${m[1]} h sedan`],
  [/^(\d+) d ago$/, (m) => `för ${m[1]} d sedan`],
  // "Acme · 12 colli · Pallet": the delivery details keep what was typed, only the type word is translated.
  [/^(.+) · (\d+) colli · (.+)$/, (m) => `${m[1]} · ${m[2]} kolli · ${SV[m[3]] ?? m[3]}`],
];

export function translate(lang: Lang, text: string): string {
  if (lang !== "sv" || !text) return text;
  const exact = SV[text];
  if (exact !== undefined) return exact;
  for (const [re, make] of PATTERNS) {
    const m = text.match(re);
    if (m) return make(m);
  }
  return text;
}

export type T = (text: string) => string;
export const makeT = (lang: Lang): T => (text) => translate(lang, text);
