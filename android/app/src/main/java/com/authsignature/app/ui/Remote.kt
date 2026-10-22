package com.authsignature.app.ui

import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.Stable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.platform.LocalContext
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.compose.LocalLifecycleOwner
import androidx.lifecycle.repeatOnLifecycle
import com.authsignature.app.AppContainer
import com.authsignature.app.container
import com.authsignature.app.data.ApiException
import kotlinx.coroutines.delay

/** Data loaded from the server, with the last error. A 401 signs the person out. */
@Stable
class Remote<T>(private val container: AppContainer, private val loader: suspend () -> T) {
    var data by mutableStateOf<T?>(null)
    var error by mutableStateOf<String?>(null)

    suspend fun refresh() {
        try {
            data = loader()
            error = null
        } catch (e: ApiException) {
            if (e.unauthorized) container.signOut() else error = e.message
        }
    }
}

/**
 * Loads [loader] when the screen appears and, if [everyMs] is set, again at that interval while the
 * screen is visible. Call [Remote.refresh] to reload right after an action.
 */
@Composable
fun <T> rememberRemote(everyMs: Long? = null, loader: suspend () -> T): Remote<T> {
    val container = LocalContext.current.container
    val lifecycle = LocalLifecycleOwner.current.lifecycle
    val remote = remember { Remote(container, loader) }
    LaunchedEffect(remote) {
        lifecycle.repeatOnLifecycle(Lifecycle.State.STARTED) {
            while (true) {
                remote.refresh()
                if (everyMs == null) break
                delay(everyMs)
            }
        }
    }
    return remote
}
