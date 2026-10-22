package com.authsignature.app.data

import kotlinx.serialization.Serializable

// The shapes the server's /api/mobile endpoints send and receive.

@Serializable
data class User(
    val id: Int,
    val email: String,
    val isAdmin: Boolean = false,
    val perms: List<String> = emptyList(),
    val mustChange: Boolean = false,
) {
    fun can(permission: String) = isAdmin || permission in perms
    val canManageUsers get() = can("create_users") || can("reset_passwords") || can("remove_users")
}

@Serializable
data class LoginResponse(val token: String, val user: User)

@Serializable
data class MeResponse(val user: User)

@Serializable
data class ApiErrorBody(val error: String? = null, val code: String? = null)

@Serializable
data class ActionResult(val ok: Boolean = false, val message: String? = null, val code: String? = null, val vcode: String? = null)

@Serializable
data class LookupResult(val ok: Boolean = false, val vcode: String? = null)

@Serializable
data class ClientHistory(val vcode: String, val at: Long, val note: String? = null)

/** status is one of: none, waiting, denied, ready. */
@Serializable
data class ClientState(val status: String, val vcode: String? = null, val history: List<ClientHistory> = emptyList())

@Serializable
data class PendingRequest(val id: Int, val number: String? = null, val askedBy: String? = null, val note: String? = null, val at: Long)

@Serializable
data class IssuedRequest(
    val id: Int,
    val vcode: String,
    val askedBy: String? = null,
    val issuedBy: String? = null,
    val note: String? = null,
    val at: Long,
)

@Serializable
data class Totals(val issued: Int = 0, val resets: Int? = null)

@Serializable
data class AdminState(val pending: List<PendingRequest> = emptyList(), val issued: List<IssuedRequest> = emptyList(), val totals: Totals = Totals())

@Serializable
data class ManagedUser(
    val id: Int,
    val email: String,
    val isAdmin: Boolean = false,
    val perms: List<String> = emptyList(),
    val isSelf: Boolean = false,
    val resetRequested: Boolean = false,
    val createdAt: Long = 0,
    val canEdit: Boolean = false,
    val canReset: Boolean = false,
    val canDelete: Boolean = false,
)

@Serializable
data class UsersState(
    val canCreate: Boolean = false,
    val adminAllowed: Boolean = false,
    val grantable: List<String> = emptyList(),
    val users: List<ManagedUser> = emptyList(),
)

@Serializable
data class Notice(
    val id: Long,
    val kind: String,
    val title: String,
    val body: String,
    val url: String = "/",
    val at: Long,
    val read: Boolean = false,
)

@Serializable
data class Feed(val items: List<Notice> = emptyList(), val unread: Int = 0, val latestId: Long = 0)

/** What each permission is called on screen. The keys match the server's. */
object Permissions {
    val all = listOf(
        "request" to ("Request codes" to "Scan numbers and see their codes"),
        "monitor" to ("Monitor" to "Look up a code by scanning its number"),
        "manage_requests" to ("Manage requests" to "Generate, deny and remove requests"),
        "create_users" to ("Create accounts" to "Add new users"),
        "reset_passwords" to ("Reset passwords" to "Not for administrators or other user managers"),
        "remove_users" to ("Remove accounts" to "Not for administrators or other user managers"),
    )

    fun label(key: String) = all.firstOrNull { it.first == key }?.second?.first ?: key
}
