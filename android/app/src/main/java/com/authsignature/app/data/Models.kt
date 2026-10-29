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

// --- Colli counter ---------------------------------------------------------------------------------
@Serializable
data class CounterRule(val len: Int, val prefix: Int)

@Serializable
data class RecentScan(val code: String, val forced: Boolean = false, val at: Long = 0)

@Serializable
data class CounterGroup(
    val id: Int,
    val number: Int = 1,
    val count: Int = 0,
    val reference: String? = null,
    val rule: CounterRule? = null,
    val source: String? = null,
    val expected: Int? = null,
)

@Serializable
data class CounterState(
    val multi: Boolean = false,
    val groups: List<CounterGroup> = emptyList(),
    val active: Boolean = false,
    val count: Int = 0,
    val reference: String? = null,
    val rule: CounterRule? = null,
    val expected: Int? = null,
    val source: String? = null,
    val noteCompare: Boolean = false,
    val recent: List<RecentScan> = emptyList(),
)

@Serializable
data class ScanReply(val outcome: String, val code: String? = null, val state: CounterState = CounterState())

@Serializable
data class FinishedCount(val colli: Int = 0, val expected: Int? = null, val deliveries: List<FinishedDelivery> = emptyList())

@Serializable
data class FinishedDelivery(val colli: Int = 0, val expected: Int? = null)

@Serializable
data class ResolveReply(val finished: FinishedCount? = null, val state: CounterState = CounterState())

@Serializable
data class NoteReading(val legible: Boolean = true, val ids: List<String> = emptyList(), val total: Int? = null, val supplier: String? = null, val comment: String? = null)

@Serializable
data class PossibleMisread(val note: String, val scanned: String)

@Serializable
data class NoteComparison(
    val matched: List<String> = emptyList(),
    val missing: List<String> = emptyList(),
    val extra: List<String> = emptyList(),
    val possible: List<PossibleMisread> = emptyList(),
    val noteCount: Int = 0,
    val scannedCount: Int = 0,
)

@Serializable
data class StatBucket(val start: String, val shipments: Int = 0, val colli: Int = 0)

@Serializable
data class StatsBlock(
    val unit: String = "day",
    val from: String = "",
    val to: String = "",
    val buckets: List<StatBucket> = emptyList(),
    val shipments: Int = 0,
    val colli: Int = 0,
    val average: Double = 0.0,
    val mismatched: Int = 0,
    val withExpected: Int = 0,
)

@Serializable
data class StatsReply(val current: StatsBlock, val compare: StatsBlock? = null)

/** What each permission is called on screen. The keys match the server's. */
object Permissions {
    val all = listOf(
        "request" to ("Request codes" to "Scan numbers and see their codes"),
        "monitor" to ("Monitor" to "Look up a code by scanning its number"),
        "manage_requests" to ("Manage requests" to "Generate, deny and remove requests"),
        "colli_counter" to ("Delivery counter" to "Count the packages of a delivery by scanning them, and see the statistics"),
        "create_users" to ("Create accounts" to "Add new users"),
        "reset_passwords" to ("Reset passwords" to "Not for administrators or other user managers"),
        "remove_users" to ("Remove accounts" to "Not for administrators or other user managers"),
    )

    fun label(key: String) = all.firstOrNull { it.first == key }?.second?.first ?: key
}
