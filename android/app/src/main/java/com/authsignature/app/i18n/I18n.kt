package com.authsignature.app.i18n

import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import java.util.Locale

/**
 * Swedish and English. The English text is the key, so a missing translation shows the English text
 * instead of breaking a screen. `lang` is Compose state: screens that call t() redraw when it changes.
 */
object I18n {
    var lang by mutableStateOf("en")
        private set

    /** The language the phone is set to, used until the person picks one. */
    fun systemLang() = if (Locale.getDefault().language == "sv") "sv" else "en"

    fun set(value: String) {
        lang = if (value == "sv") "sv" else "en"
    }

    fun t(text: String): String {
        if (lang != "sv" || text.isEmpty()) return text
        APP_SV[text]?.let { return it }
        SHARED_SV[text]?.let { return it }
        for ((re, make) in PATTERNS) {
            re.matchEntire(text)?.let { return make(it.groupValues) }
        }
        return text
    }

    private val APP_SV = mapOf(
        // Account
        "Password changed." to "Lösenordet är bytt.",
        "Sounds and alerts" to "Ljud och aviseringar",
        "A different tone for each notification and action" to "En egen ton för varje notis och handling",
        "Alerts when the app is closed" to "Aviseringar när appen är stängd",
        "Keeps checking for new requests and codes. Android shows a small ongoing notification." to
            "Fortsätter att leta efter nya begäranden och koder. Android visar en liten pågående notis.",
        "Hide the tones" to "Dölj tonerna",
        "New password (min 8)" to "Nytt lösenord (minst 8)",
        "Sign out" to "Logga ut",
        "Notification check" to "Notiskontroll",
        "Not checked yet" to "Inte kontrollerad ännu",
        "The phone is on silent or vibrate. Switch it to sound to hear tones." to "Telefonen är på ljudlöst eller vibrera. Slå på ljud för att höra tonerna.",
        "The notification volume is at zero. Raise it in the phone's sound settings." to "Notisvolymen är noll. Höj den i telefonens ljudinställningar.",
        "Language" to "Språk",
        // Requests
        "Remove this request?" to "Ta bort denna begäran?",
        "Client note" to "Leverans",
        "No note." to "Inga leveransuppgifter.",
        "The client" to "Kunden",
        // Scan
        "Enter the supplier name, the number of colli and choose the colli type first" to "Ange först leverantörens namn och antal kolli, och välj kollityp",
        "YOUR VERIFICATION CODE" to "DIN VERIFIERINGSKOD",
        // Sign in
        "The admin has been notified." to "Administratören har meddelats.",
        "Choose a new password" to "Välj ett nytt lösenord",
        "You need to choose your own password before you can continue." to "Du måste välja ett eget lösenord innan du kan fortsätta.",
        "Current (temporary) password" to "Nuvarande (tillfälligt) lösenord",
        "Can't reach the server. Check your connection." to "Kan inte nå servern. Kontrollera anslutningen.",
        // Monitor
        "VERIFICATION CODE" to "VERIFIERINGSKOD",
        "NOT AVAILABLE" to "INTE TILLGÄNGLIG",
        "ERROR" to "FEL",
        // Users
        "Edit user" to "Ändra användare",
        "Temporary password" to "Tillfälligt lösenord",
        "Initial password (min 8)" to "Första lösenord (minst 8)",
        // Notifications
        "New requests" to "Nya begäranden",
        "Your requests" to "Dina begäranden",
        "Background alerts" to "Bakgrundsaviseringar",
        "A client asked for a verification code" to "En kund begärde en verifieringskod",
        "Your code is ready, or your request was denied or removed" to "Din kod är klar, eller din begäran nekades eller togs bort",
        "Password reset requests and changes to your access" to "Begäran om nytt lösenord och ändringar av din behörighet",
        "Shown while the app checks for notifications in the background" to "Visas medan appen söker efter notiser i bakgrunden",
        "Watching for new requests and codes" to "Bevakar nya begäranden och koder",
        "Compare with the previous period" to "Jämför med föregående period",
        "Loading…" to "Läser in…",
    )

    private val PATTERNS: List<Pair<Regex, (List<String>) -> String>> = listOf(
        Regex("""Asked by (.+) · (.+)""") to { m -> "${t("Asked by")} ${t(m[1])} · ${m[2]}" },
        Regex("""Asked by (.+)""") to { m -> "${t("Asked by")} ${t(m[1])}" },
        Regex("""Issued by (.+)""") to { m -> "${t("Issued by")} ${t(m[1])}" },
        Regex("""(.+) will be told it was denied\. They can scan the number again to ask once more\.""") to
            { m -> "${t(m[1])} får veta att begäran nekades. De kan skanna numret igen för att begära på nytt." },
        Regex("""Its code (.+) stops working on the monitor and leaves the client's history\. This cannot be undone\.""") to
            { m -> "Koden ${m[1]} slutar fungera i kontrollen och försvinner ur kundens historik. Det går inte att ångra." },
        Regex("""All users \((\d+)\)""") to { m -> "Alla användare (${m[1]})" },
        Regex("""The note says (\d+) colli, you counted (\d+)\.""") to { m -> "Följesedeln anger ${m[1]} kolli, du räknade ${m[2]}." },
        Regex("""The note says (\d+) colli\.""") to { m -> "Följesedeln anger ${m[1]} kolli." },
        Regex("""(\d+) of (\d+) on the note were scanned\.""") to { m -> "${m[1]} av ${m[2]} på följesedeln är skannade." },
        Regex("""(Missing: .+|Extra: .+|Possible misread) \((\d+)\)""") to { m -> "${t(m[1])} (${m[2]})" },
        Regex("""(.+) will be signed out and lose access\. Their requests stay on record\.""") to
            { m -> "${m[1]} loggas ut och förlorar åtkomst. Deras begäranden finns kvar i historiken." },
        Regex("""Give this to (.+)\. It is shown only once, and they must choose a new password when they sign in\.""") to
            { m -> "Ge detta till ${m[1]}. Det visas bara en gång, och de måste välja ett nytt lösenord när de loggar in." },
        Regex("""Created (.+)\. They choose a new password at first sign-in\.""") to
            { m -> "${m[1]} skapades. De väljer ett nytt lösenord vid första inloggningen." },
        Regex("""Created (.+?)( · You)?""") to { m -> "Skapad ${m[1]}${if (m[2].isNotEmpty()) " · Du" else ""}" },
        Regex("""Notification check: (.+)""") to { m -> "${t("Notification check")}: ${t(m[1])}" },
        Regex("""Working, last check (.+)""") to { m -> "Fungerar, senaste kontroll ${m[1]}" },
        Regex("""Server said: (.+)""") to { m -> "Servern svarade: ${m[1]}" },
        Regex("""Cannot reach the server \((.+)\)""") to { m -> "Kan inte nå servern (${m[1]})" },
        Regex("""Something went wrong \((\d+)\)""") to { m -> "Något gick fel (${m[1]})" },
        Regex("""Matches the expected (\d+)""") to { m -> "Stämmer med förväntade ${m[1]}" },
        Regex("""Expected (\d+): (\d+) fewer""") to { m -> "Förväntat ${m[1]}: ${m[2]} färre" },
        Regex("""Expected (\d+): (\d+) more""") to { m -> "Förväntat ${m[1]}: ${m[2]} fler" },
        Regex("""of (\d+) expected""") to { m -> "av ${m[1]} förväntade" },
        Regex("""Previous shipment saved: (\d+) colli""") to { m -> "Föregående leverans sparad: ${m[1]} kolli" },
        Regex("""Matching: first (\d+) of (\d+) characters""") to { m -> "Matchar: första ${m[1]} av ${m[2]} tecken" },
        Regex("""Finish with (\d+) colli\?""") to { m -> "Slutföra med ${m[1]} kolli?" },
        Regex("""(\d+) of (\d+) shipments with an expected number differed from it\.""") to
            { m -> "${m[1]} av ${m[2]} leveranser med ett förväntat antal avvek från det." },
        Regex("""before: (.+)""") to { m -> "före: ${m[1]}" },
        Regex("""(\d+) min ago""") to { m -> "för ${m[1]} min sedan" },
        Regex("""(\d+) h ago""") to { m -> "för ${m[1]} h sedan" },
        Regex("""(\d+) d ago""") to { m -> "för ${m[1]} d sedan" },
        Regex("""(.+) · (\d+) colli""") to { m -> "${m[1]} · ${m[2]} kolli" },
        Regex("""(.+) · (\d+) colli · (.+)""") to { m -> "${m[1]} · ${m[2]} kolli · ${t(m[3])}" },
        Regex("""(.+) · ([\d.,]+) s""") to { m -> "${t(m[1])} · ${m[2]} s" },
    )
}

/** Shorthand used by screens and services. */
fun t(text: String): String = I18n.t(text)
