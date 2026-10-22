package com.authsignature.app

import android.app.Application
import android.content.Context
import com.authsignature.app.data.Api
import com.authsignature.app.data.Notice
import com.authsignature.app.data.SessionStore
import com.authsignature.app.data.User
import com.authsignature.app.notify.AlertService
import com.authsignature.app.notify.NotificationHelper
import com.authsignature.app.notify.NotificationPoller
import com.authsignature.app.sound.Tone
import com.authsignature.app.sound.Tones
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow

class AuthApp : Application() {
    lateinit var container: AppContainer
        private set

    override fun onCreate() {
        super.onCreate()
        container = AppContainer(this)
        NotificationHelper.createChannels(this)
    }
}

val Context.container: AppContainer get() = (applicationContext as AuthApp).container

/** Everything the screens share: sign-in state, the API client, notifications and sound. */
class AppContainer(val app: Application, apiBase: String = BuildConfig.API_BASE) {
    val store = SessionStore(app)
    val scope = CoroutineScope(SupervisorJob() + Dispatchers.Default)
    val api = Api(apiBase) { store.token }

    private val _user = MutableStateFlow(if (store.token != null) store.user else null)
    val user: StateFlow<User?> = _user

    val poller = NotificationPoller(api, scope, onUnauthorized = { signOut() })

    /** Called when the server says the saved token is no longer valid. */
    fun signOut() {
        store.signOut()
        poller.reset()
        AlertService.stop(app)
        _user.value = null
    }

    suspend fun signIn(email: String, password: String) {
        val result = api.login(email.trim(), password)
        store.token = result.token
        store.user = result.user
        poller.reset()
        _user.value = result.user
    }

    suspend fun changePassword(current: String, next: String, confirm: String) {
        val result = api.changePassword(current, next, confirm)
        store.token = result.token
        store.user = result.user
        _user.value = result.user
    }

    /** Refreshes what the signed-in person may do, in case an admin changed it. */
    suspend fun refreshUser() {
        if (store.token == null) return
        val fresh = api.me()
        store.user = fresh
        _user.value = fresh
    }

    /** Plays a tone and vibrates, unless sound is switched off on this device. */
    fun signal(tone: Tone) {
        if (!store.sound) return
        runCatching { Tones.play(tone) }
        runCatching { Tones.vibrate(app, tone) }
    }

    fun signalFor(notice: Notice) {
        Tone.forKind(notice.kind)?.let { signal(it) }
    }
}
