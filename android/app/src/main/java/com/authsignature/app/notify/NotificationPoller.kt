package com.authsignature.app.notify

import com.authsignature.app.data.Api
import com.authsignature.app.data.ApiException
import com.authsignature.app.data.Notice
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharedFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch

/**
 * Asks the server every few seconds whether something new arrived for this person. There is one
 * loop for the whole app; the open screens and the background service both listen to it.
 */
class NotificationPoller(
    private val api: Api,
    private val scope: CoroutineScope,
    private val onUnauthorized: () -> Unit,
    private val intervalMs: Long = 4000,
) {
    private val _items = MutableStateFlow<List<Notice>>(emptyList())
    val items: StateFlow<List<Notice>> = _items

    private val _unread = MutableStateFlow(0)
    val unread: StateFlow<Int> = _unread

    private val _events = MutableSharedFlow<Notice>(extraBufferCapacity = 32)

    /** One event for every notification that arrives after the first check. */
    val events: SharedFlow<Notice> = _events

    private val _status = MutableStateFlow("Not checked yet")

    /** How the last check went, shown on the Account screen to find out why alerts are missing. */
    val status: StateFlow<String> = _status

    private var job: Job? = null
    private var lastId: Long? = null

    fun start() {
        if (job?.isActive == true) return
        job = scope.launch {
            while (isActive) {
                try {
                    pollOnce()
                    _status.value = "Working, last check ${java.text.SimpleDateFormat("HH:mm:ss", java.util.Locale.US).format(java.util.Date())}"
                } catch (e: ApiException) {
                    _status.value = "Server said: ${e.message}"
                    if (e.unauthorized) {
                        onUnauthorized()
                        return@launch
                    }
                } catch (e: Exception) {
                    _status.value = "Cannot reach the server (${e.javaClass.simpleName})"
                    // Offline for a moment; the next round tries again.
                }
                delay(intervalMs)
            }
        }
    }

    fun stop() {
        job?.cancel()
        job = null
    }

    /** Forgets everything, for when someone signs out or in. */
    fun reset() {
        stop()
        lastId = null
        _items.value = emptyList()
        _unread.value = 0
    }

    suspend fun pollOnce() {
        val first = lastId == null
        val feed = api.notifications(lastId)
        _unread.value = feed.unread
        if (first) {
            // The first answer only fills the list: what is already there does not ring.
            _items.value = feed.items
            lastId = feed.latestId
            return
        }
        if (feed.items.isNotEmpty()) {
            lastId = maxOf(lastId ?: 0, feed.items.maxOf { it.id })
            _items.value = (feed.items.reversed() + _items.value).take(15)
            feed.items.forEach { _events.emit(it) }
        }
    }

    suspend fun markAllRead() {
        api.markRead()
        _unread.value = 0
        _items.value = _items.value.map { it.copy(read = true) }
    }
}
