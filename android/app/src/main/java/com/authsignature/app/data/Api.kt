package com.authsignature.app.data

import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonNull
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import java.io.IOException
import java.util.concurrent.TimeUnit

/** A refused or failed call. [status] is the HTTP status, or 0 when the server could not be reached. */
class ApiException(val status: Int, override val message: String, val code: String? = null) : Exception(message) {
    val unauthorized get() = status == 401
}

private val json = Json { ignoreUnknownKeys = true; coerceInputValues = true; explicitNulls = false }

/** Talks to the server's /api/mobile endpoints. The token is sent as a Bearer header. */
class Api(private val baseUrl: String, private val token: () -> String?) {
    private val http = OkHttpClient.Builder()
        .connectTimeout(15, TimeUnit.SECONDS)
        .readTimeout(20, TimeUnit.SECONDS)
        .writeTimeout(20, TimeUnit.SECONDS)
        .build()

    private suspend fun call(method: String, path: String, body: JsonObject? = null): String = withContext(Dispatchers.IO) {
        val builder = Request.Builder().url(baseUrl.trimEnd('/') + "/api/mobile" + path)
        token()?.let { builder.header("Authorization", "Bearer $it") }
        builder.header("Accept", "application/json")
        if (method == "POST") {
            builder.post((body ?: JsonObject(emptyMap())).toString().toRequestBody("application/json".toMediaType()))
        } else {
            builder.get()
        }
        try {
            http.newCall(builder.build()).execute().use { res ->
                val text = res.body?.string().orEmpty()
                if (res.isSuccessful) return@use text
                val err = runCatching { json.decodeFromString<ApiErrorBody>(text) }.getOrNull()
                throw ApiException(res.code, err?.error ?: "Something went wrong (${res.code})", err?.code)
            }
        } catch (e: IOException) {
            throw ApiException(0, "Can't reach the server. Check your connection.")
        }
    }

    private fun obj(vararg pairs: Pair<String, Any?>) = JsonObject(
        pairs.mapNotNull { (k, v) -> toJson(v)?.let { k to it } }.toMap(),
    )

    private fun toJson(v: Any?): JsonElement? = when (v) {
        null -> null
        is String -> JsonPrimitive(v)
        is Boolean -> JsonPrimitive(v)
        is Number -> JsonPrimitive(v)
        is List<*> -> JsonArray(v.mapNotNull { toJson(it) })
        else -> JsonNull
    }

    // --- sign in and account ---------------------------------------------------------------
    suspend fun login(email: String, password: String) =
        json.decodeFromString<LoginResponse>(call("POST", "/login", obj("email" to email, "password" to password)))

    suspend fun me() = json.decodeFromString<MeResponse>(call("GET", "/me")).user

    suspend fun changePassword(current: String, next: String, confirm: String) =
        json.decodeFromString<LoginResponse>(call("POST", "/password", obj("current" to current, "next" to next, "confirm" to confirm)))

    suspend fun forgot(email: String) =
        json.decodeFromString<ActionResult>(call("POST", "/forgot", obj("email" to email)))

    // --- client and monitor ----------------------------------------------------------------
    suspend fun client() = json.decodeFromString<ClientState>(call("GET", "/client"))

    suspend fun request(code: String, note: String?) =
        json.decodeFromString<ActionResult>(call("POST", "/request", obj("code" to code, "note" to note?.takeIf { it.isNotBlank() })))

    suspend fun lookup(code: String): String =
        json.decodeFromString<LookupResult>(call("POST", "/lookup", obj("code" to code))).vcode.orEmpty()

    // --- admin -------------------------------------------------------------------------------
    suspend fun admin() = json.decodeFromString<AdminState>(call("GET", "/admin"))
    suspend fun issue(id: Int) = call("POST", "/admin/issue", obj("id" to id))
    suspend fun deny(id: Int) = call("POST", "/admin/deny", obj("id" to id))
    suspend fun remove(id: Int) = call("POST", "/admin/remove", obj("id" to id))

    // --- users -------------------------------------------------------------------------------
    suspend fun users() = json.decodeFromString<UsersState>(call("GET", "/users"))

    suspend fun createUser(email: String, password: String, admin: Boolean, perms: List<String>) =
        json.decodeFromString<ActionResult>(call("POST", "/users/create", obj("email" to email, "password" to password, "admin" to admin, "perms" to perms)))

    suspend fun updateUser(id: Int, email: String, admin: Boolean, perms: List<String>) =
        json.decodeFromString<ActionResult>(call("POST", "/users/update", obj("id" to id, "email" to email, "admin" to admin, "perms" to perms)))

    suspend fun deleteUser(id: Int) = json.decodeFromString<ActionResult>(call("POST", "/users/delete", obj("id" to id)))

    suspend fun resetPassword(id: Int) = json.decodeFromString<ActionResult>(call("POST", "/users/reset", obj("id" to id)))

    // --- notifications ------------------------------------------------------------------------
    suspend fun notifications(after: Long?) =
        json.decodeFromString<Feed>(call("GET", if (after == null) "/notifications?list=1" else "/notifications?after=$after"))

    suspend fun markRead() = call("POST", "/notifications/read")
}
