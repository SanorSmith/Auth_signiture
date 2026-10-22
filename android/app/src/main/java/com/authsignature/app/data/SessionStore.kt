package com.authsignature.app.data

import android.content.Context
import android.content.SharedPreferences
import androidx.security.crypto.EncryptedSharedPreferences
import androidx.security.crypto.MasterKey
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.Json

/** Keeps the sign-in token (encrypted with the Android Keystore) and the person's settings on this device. */
class SessionStore(context: Context) {
    private val prefs: SharedPreferences = try {
        EncryptedSharedPreferences.create(
            context,
            "auth_signature_secure",
            MasterKey.Builder(context).setKeyScheme(MasterKey.KeyScheme.AES256_GCM).build(),
            EncryptedSharedPreferences.PrefKeyEncryptionScheme.AES256_SIV,
            EncryptedSharedPreferences.PrefValueEncryptionScheme.AES256_GCM,
        )
    } catch (e: Exception) {
        // If the keystore is unavailable the app still works; the token then lives in private app storage.
        context.getSharedPreferences("auth_signature_plain", Context.MODE_PRIVATE)
    }

    private val json = Json { ignoreUnknownKeys = true }

    var token: String?
        get() = prefs.getString(KEY_TOKEN, null)
        set(value) = prefs.edit().apply { if (value == null) remove(KEY_TOKEN) else putString(KEY_TOKEN, value) }.apply()

    var user: User?
        get() = prefs.getString(KEY_USER, null)?.let { runCatching { json.decodeFromString<User>(it) }.getOrNull() }
        set(value) = prefs.edit().apply { if (value == null) remove(KEY_USER) else putString(KEY_USER, json.encodeToString(value)) }.apply()

    /** Play tones and vibrate for notifications and actions. */
    var sound: Boolean
        get() = prefs.getBoolean(KEY_SOUND, true)
        set(value) = prefs.edit().putBoolean(KEY_SOUND, value).apply()

    /** Keep checking for notifications while the app is closed (a small ongoing notification shows). */
    var backgroundAlerts: Boolean
        get() = prefs.getBoolean(KEY_BACKGROUND, false)
        set(value) = prefs.edit().putBoolean(KEY_BACKGROUND, value).apply()

    var askedAboutBackground: Boolean
        get() = prefs.getBoolean(KEY_ASKED, false)
        set(value) = prefs.edit().putBoolean(KEY_ASKED, value).apply()

    fun signOut() {
        prefs.edit().remove(KEY_TOKEN).remove(KEY_USER).apply()
    }

    private companion object {
        const val KEY_TOKEN = "token"
        const val KEY_USER = "user"
        const val KEY_SOUND = "sound"
        const val KEY_BACKGROUND = "background_alerts"
        const val KEY_ASKED = "asked_background"
    }
}
