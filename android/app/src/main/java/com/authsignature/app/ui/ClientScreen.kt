package com.authsignature.app.ui

import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Button
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import com.authsignature.app.container
import com.authsignature.app.data.ApiException
import com.authsignature.app.data.ClientState
import com.authsignature.app.scan.ScanBus
import com.authsignature.app.sound.Tone
import kotlinx.coroutines.launch

private const val SUPPLIER_MAX = 36
private val COLLI_TYPES = listOf("Carton", "Pallet", "Bundle", "Pack")

/** Scan a number, see the code the admin issues for it, and the last three issued codes. */
@OptIn(androidx.compose.foundation.layout.ExperimentalLayoutApi::class)
@Composable
fun ClientScreen() {
    val container = LocalContext.current.container
    val scope = rememberCoroutineScope()
    val remote = rememberRemote(everyMs = 5000) { container.api.client() }
    val focus = remember { FocusRequester() }

    var number by remember { mutableStateOf("") }
    var supplier by remember { mutableStateOf("") }
    var colli by remember { mutableStateOf("") }
    var colliType by remember { mutableStateOf("") }
    var busy by remember { mutableStateOf(false) }
    var okMessage by remember { mutableStateOf<String?>(null) }
    var errorMessage by remember { mutableStateOf<String?>(null) }

    fun send(code: String) {
        if (busy) return
        if (supplier.trim().length < 2 || colli.toIntOrNull()?.let { it in 1..9999 } != true || colliType !in COLLI_TYPES) {
            errorMessage = "Enter the supplier name, the number of colli and choose the colli type first"
            okMessage = null
            container.signal(Tone.Error)
            return
        }
        if (code.length != 10) {
            errorMessage = "Not a valid 10-digit number"
            okMessage = null
            container.signal(Tone.Error)
            return
        }
        busy = true
        okMessage = null
        errorMessage = null
        scope.launch {
            try {
                okMessage = container.api.request(code, supplier.trim(), colli, colliType.trim()).message ?: "Request sent, waiting for the admin"
                container.signal(Tone.Sent)
                number = ""
                supplier = ""
                colli = ""
                colliType = ""
                remote.refresh()
            } catch (e: ApiException) {
                if (e.unauthorized) container.signOut() else errorMessage = e.message
                container.signal(Tone.Error)
            } finally {
                busy = false
                runCatching { focus.requestFocus() }
            }
        }
    }

    // A Zebra scanner sends the number straight to the app.
    LaunchedEffect(Unit) {
        ScanBus.scans.collect { raw ->
            val digits = raw.filter(Char::isDigit)
            number = digits.take(10)
            send(digits.take(10))
        }
    }
    // The admin acted on a request: show it at once instead of waiting for the next refresh.
    LaunchedEffect(Unit) { container.poller.events.collect { remote.refresh() } }

    Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
        val state = remote.data
        when {
            state == null && remote.error == null -> Loading()
            state == null -> ErrorNote(remote.error ?: "Could not load")
            else -> ResultCard(state)
        }

        AppCard {
            Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
                OutlinedTextField(
                    value = supplier,
                    onValueChange = { supplier = it.take(SUPPLIER_MAX) },
                    label = { Text("Supplier name") },
                    placeholder = { Text("Who delivers?") },
                    singleLine = true,
                    shape = RoundedCornerShape(12.dp),
                    modifier = Modifier.fillMaxWidth(),
                )
                OutlinedTextField(
                    value = colli,
                    onValueChange = { colli = it.filter(Char::isDigit).take(4) },
                    label = { Text("Number of colli") },
                    placeholder = { Text("How many packages?") },
                    singleLine = true,
                    keyboardOptions = androidx.compose.foundation.text.KeyboardOptions(keyboardType = androidx.compose.ui.text.input.KeyboardType.Number),
                    shape = RoundedCornerShape(12.dp),
                    modifier = Modifier.fillMaxWidth(),
                )
                Text("Colli type", style = MaterialTheme.typography.labelMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
                androidx.compose.foundation.layout.FlowRow(
                    horizontalArrangement = Arrangement.spacedBy(8.dp),
                    verticalArrangement = Arrangement.spacedBy(4.dp),
                ) {
                    COLLI_TYPES.forEach { type ->
                        androidx.compose.material3.FilterChip(
                            selected = colliType == type,
                            onClick = { colliType = type },
                            label = { Text(type) },
                        )
                    }
                }
                ScanNumberField(number, { number = it }, { send(number) }, focus)
                okMessage?.let { SuccessNote(it) }
                errorMessage?.let { ErrorNote(it) }
                Button(onClick = { send(number) }, enabled = !busy, modifier = Modifier.fillMaxWidth().height(50.dp), shape = RoundedCornerShape(12.dp)) {
                    Text(if (busy) "Sending…" else "Send request")
                }
            }
        }

        state?.history?.takeIf { it.isNotEmpty() }?.let { history ->
            AppCard {
                Column {
                    Text(
                        "Last ${history.size} verified code${if (history.size > 1) "s" else ""}",
                        style = MaterialTheme.typography.titleSmall,
                        fontWeight = FontWeight.SemiBold,
                        modifier = Modifier.padding(16.dp),
                    )
                    history.forEachIndexed { i, h ->
                        HorizontalDivider(color = MaterialTheme.colorScheme.outlineVariant)
                        Row(Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 12.dp), verticalAlignment = Alignment.CenterVertically) {
                            Column(Modifier.weight(1f)) {
                                Text(clock(h.at), style = MaterialTheme.typography.labelMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
                                h.note?.let { Text(it, maxLines = 1, overflow = TextOverflow.Ellipsis, style = MaterialTheme.typography.bodyMedium) }
                            }
                            Spacer(Modifier.width(12.dp))
                            Text(h.vcode, fontFamily = FontFamily.Monospace, fontWeight = FontWeight.SemiBold, style = MaterialTheme.typography.titleLarge)
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun ResultCard(state: ClientState) {
    when (state.status) {
        "ready" -> AppCard(container = MaterialTheme.colorScheme.primaryContainer, border = MaterialTheme.colorScheme.primary.copy(alpha = 0.25f)) {
            Column(Modifier.padding(horizontal = 16.dp, vertical = 20.dp), horizontalAlignment = Alignment.CenterHorizontally) {
                Text("YOUR VERIFICATION CODE", style = MaterialTheme.typography.labelMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
                Spacer(Modifier.height(4.dp))
                CodeText(state.vcode.orEmpty(), MaterialTheme.colorScheme.primary)
            }
        }
        "waiting" -> AppCard {
            Row(Modifier.fillMaxWidth().padding(20.dp), horizontalArrangement = Arrangement.Center, verticalAlignment = Alignment.CenterVertically) {
                val pulse = rememberInfiniteTransition(label = "pulse")
                val alpha by pulse.animateFloat(0.3f, 1f, infiniteRepeatable(tween(800), RepeatMode.Reverse), label = "alpha")
                Box(Modifier.size(10.dp).background(status.warn.copy(alpha = alpha), CircleShape))
                Spacer(Modifier.width(10.dp))
                Text("Waiting for the admin…", color = status.warn, fontWeight = FontWeight.Medium)
            }
        }
        "denied" -> AppCard(container = MaterialTheme.colorScheme.errorContainer, border = MaterialTheme.colorScheme.error.copy(alpha = 0.3f)) {
            Column(Modifier.padding(20.dp), horizontalAlignment = Alignment.CenterHorizontally) {
                Text("Request denied", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.SemiBold, color = MaterialTheme.colorScheme.onErrorContainer)
                Text(
                    "The admin denied this request. Scan the number again to ask once more.",
                    textAlign = TextAlign.Center,
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onErrorContainer,
                )
            }
        }
        else -> EmptyNote("No code yet. Scan a number to get started.")
    }
}
