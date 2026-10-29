package com.authsignature.app.ui

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.FilterChip
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.rememberUpdatedState
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.authsignature.app.container
import com.authsignature.app.data.ApiException
import com.authsignature.app.data.CounterState
import com.authsignature.app.data.FinishedCount
import com.authsignature.app.scan.ScanBus
import com.authsignature.app.sound.Tone
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch

/** The Colli counter tab: counting, and the statistics. */
@Composable
fun CounterTab(isAdmin: Boolean) {
    var page by rememberSaveable { mutableStateOf(0) }
    Column(Modifier.fillMaxSize()) {
        // Statistics are for administrators; everyone else only counts.
        if (isAdmin) {
            Row(Modifier.padding(horizontal = 16.dp, vertical = 8.dp), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                FilterChip(selected = page == 0, onClick = { page = 0 }, label = { Text("Count") })
                FilterChip(selected = page == 1, onClick = { page = 1 }, label = { Text("Statistics") })
            }
        }
        if (page == 0 || !isAdmin) CounterScreen() else CounterStatsScreen()
    }
}

private enum class Kind(val label: String) {
    Counted("Counted"),
    Duplicate("Already counted"),
    Forced("Counted anyway"),
    Ignored("Ignored"),
}

private data class Entry(val code: String, val kind: Kind)

/**
 * Counting the packages of one shipment. The first two scans show which part of the code identifies
 * the shipment; later scans must share it. A package scanned twice, or one that belongs to another
 * shipment, sounds its own alert (the wrong-shipment alert repeats until the person decides).
 */
@OptIn(ExperimentalLayoutApi::class)
@Composable
fun CounterScreen() {
    val container = LocalContext.current.container
    val scope = rememberCoroutineScope()
    val focus = remember { FocusRequester() }

    var state by remember { mutableStateOf<CounterState?>(null) }
    var feed by remember { mutableStateOf(listOf<Entry>()) }
    var pending by remember { mutableStateOf<String?>(null) }
    var confirm by remember { mutableStateOf<String?>(null) }
    var result by remember { mutableStateOf<FinishedCount?>(null) }
    var notice by remember { mutableStateOf<String?>(null) }
    var error by remember { mutableStateOf<String?>(null) }
    var busy by remember { mutableStateOf(false) }
    var code by remember { mutableStateOf("") }
    var expectedText by remember { mutableStateOf("") }

    val locked = pending != null || confirm != null || result != null || busy
    val lockedNow by rememberUpdatedState(locked)
    val current = state ?: CounterState()

    fun note(code: String, kind: Kind) {
        feed = (listOf(Entry(code, kind)) + feed).take(8)
    }

    fun setState(next: CounterState) {
        state = next
        expectedText = next.expected?.toString() ?: ""
    }

    /** Runs a server call with the screen locked; a signed-out token ends the session. */
    fun call(block: suspend () -> Unit) {
        busy = true
        error = null
        scope.launch {
            try {
                block()
            } catch (e: ApiException) {
                if (e.unauthorized) container.signOut() else error = e.message
                container.signal(Tone.Error)
            } finally {
                busy = false
                runCatching { focus.requestFocus() }
            }
        }
    }

    LaunchedEffect(Unit) {
        try {
            setState(container.api.counterState())
        } catch (e: ApiException) {
            if (e.unauthorized) container.signOut() else error = e.message
        }
    }

    // A package that does not fit keeps sounding every few seconds until the person decides.
    LaunchedEffect(pending) {
        while (pending != null) {
            container.signal(Tone.Mismatch)
            delay(4000)
        }
    }

    fun scan(raw: String) {
        val value = raw.trim()
        if (value.isEmpty() || lockedNow) return
        notice = null
        call {
            val reply = container.api.counterScan(value)
            setState(reply.state)
            when (reply.outcome) {
                "counted" -> {
                    note(reply.code ?: value, Kind.Counted)
                    container.signal(Tone.Counted)
                }
                "duplicate" -> {
                    note(reply.code ?: value, Kind.Duplicate)
                    container.signal(Tone.Duplicate)
                }
                "new_delivery" -> {
                    note(reply.code ?: value, Kind.Counted)
                    container.signal(Tone.Delivery)
                }
                "mismatch" -> pending = reply.code ?: value
                else -> {
                    error = "Not a valid package code"
                    container.signal(Tone.Error)
                }
            }
            code = ""
        }
    }

    fun decide(choice: String) {
        val value = pending ?: return
        call {
            val reply = container.api.counterResolve(value, choice)
            pending = null
            setState(reply.state)
            when (choice) {
                "ignore" -> {
                    note(value, Kind.Ignored)
                    container.signal(Tone.Deleted)
                }
                "count" -> {
                    note(value, Kind.Forced)
                    container.signal(Tone.Counted)
                }
                "delivery" -> {
                    note(value, Kind.Counted)
                    container.signal(Tone.Delivery)
                }
                else -> {
                    feed = listOf(Entry(value, Kind.Counted))
                    notice = reply.finished?.let { "Previous shipment saved: ${it.colli} colli" }
                    container.signal(Tone.Finished)
                }
            }
            code = ""
        }
    }

    fun saveExpected() {
        val n = expectedText.toIntOrNull()?.takeIf { it in 1..9999 }
        if (n == current.expected) return
        call { setState(container.api.counterExpected(n)) }
    }

    // A Zebra scanner sends the package code straight to the app.
    LaunchedEffect(Unit) { ScanBus.scans.collect { raw -> scan(raw) } }

    // The result of a finished count.
    result?.let { done ->
        val list = done.deliveries.takeIf { it.size > 1 }
        val diff = done.expected?.let { done.colli - it }
        Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
            AppCard(container = MaterialTheme.colorScheme.primaryContainer) {
                Column(Modifier.fillMaxWidth().padding(24.dp), horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    Text(if (list != null) "Deliveries counted" else "Shipment counted", style = MaterialTheme.typography.labelMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
                    Text(done.colli.toString(), fontSize = 88.sp, fontWeight = FontWeight.Bold, fontFamily = FontFamily.Monospace, color = MaterialTheme.colorScheme.primary)
                    Text("colli received", style = MaterialTheme.typography.titleMedium)
                    list?.forEachIndexed { i, d ->
                        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
                            Text("Delivery ${i + 1}")
                            Row(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.CenterVertically) {
                                d.expected?.let { e ->
                                    if (d.colli == e) Pill("Matches the expected $e", MaterialTheme.colorScheme.primaryContainer, MaterialTheme.colorScheme.onPrimaryContainer)
                                    else Pill("Expected $e: ${kotlin.math.abs(d.colli - e)} ${if (d.colli < e) "fewer" else "more"}", MaterialTheme.colorScheme.surfaceVariant, MaterialTheme.colorScheme.onSurfaceVariant)
                                }
                                Text(d.colli.toString(), fontFamily = FontFamily.Monospace, fontWeight = FontWeight.Bold, fontSize = 18.sp)
                            }
                        }
                    }
                    if (list == null && diff != null) {
                        if (diff == 0) SuccessNote("Matches the expected ${done.expected}")
                        else ErrorNote("Expected ${done.expected}: ${kotlin.math.abs(diff)} ${if (diff < 0) "fewer" else "more"}")
                    }
                }
            }
            Button(
                onClick = {
                    result = null
                    notice = null
                    runCatching { focus.requestFocus() }
                },
                modifier = Modifier.fillMaxWidth().height(52.dp),
                shape = RoundedCornerShape(12.dp),
            ) { Text("Count the next shipment") }
        }
        return
    }

    val multi = current.multi
    val started = current.count > 0 || (multi && current.groups.isNotEmpty())

    Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(horizontal = 16.dp).padding(bottom = 16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
        if (!started) {
            AppCard {
                Column(Modifier.fillMaxWidth().padding(12.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    Text("What are you counting?", fontWeight = FontWeight.Medium)
                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        FilterChip(selected = !multi, onClick = { if (multi) call { setState(container.api.counterMode(false)) } }, enabled = !locked, label = { Text("One delivery") })
                        FilterChip(selected = multi, onClick = { if (!multi) call { setState(container.api.counterMode(true)) } }, enabled = !locked, label = { Text("Several deliveries") })
                    }
                    if (multi) Text("Scan the packages in any order. Each one joins the delivery it belongs to, or starts a new one.", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                }
            }
        } else if (multi && current.groups.size <= 1) {
            TextButton(onClick = { call { setState(container.api.counterMode(false)) } }, enabled = !locked) { Text("Back to one delivery") }
        }

        AppCard {
            Column(Modifier.fillMaxWidth().padding(16.dp), horizontalAlignment = Alignment.CenterHorizontally) {
                Text("colli counted", style = MaterialTheme.typography.labelMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
                Text(
                    current.count.toString(),
                    fontSize = 72.sp,
                    fontWeight = FontWeight.Bold,
                    fontFamily = FontFamily.Monospace,
                    color = if (current.expected != null && current.count == current.expected) com.authsignature.app.ui.status.success else MaterialTheme.colorScheme.primary,
                )
                if (multi && current.groups.isNotEmpty()) {
                    Text(if (current.groups.size == 1) "1 delivery" else "${current.groups.size} deliveries", style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
                }
                if (!multi) current.expected?.let { Text("of $it expected", style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant) }
                notice?.let { SuccessNote(it, Modifier.padding(top = 8.dp)) }
            }
        }

        AppCard {
            Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
                ScanNumberField(
                    value = code,
                    onValueChange = { code = it },
                    onSubmit = { scan(code) },
                    focusRequester = focus,
                    label = "Package code",
                    digitsOnly = false,
                    maxLength = 64,
                    enabled = !locked,
                )
                error?.let { ErrorNote(it) }
                Button(onClick = { scan(code) }, enabled = !locked, modifier = Modifier.fillMaxWidth().height(50.dp), shape = RoundedCornerShape(12.dp)) {
                    Text("Count package")
                }

                val ref = current.reference
                val rule = current.rule
                if (!multi) AppCard(container = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.4f)) {
                    Column(Modifier.fillMaxWidth().padding(12.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                        when {
                            ref == null -> Text("Scan the first package of the shipment.", color = MaterialTheme.colorScheme.onSurfaceVariant)
                            rule == null -> Text("Scan the second package. The shipment part of the code is worked out from it.", color = MaterialTheme.colorScheme.onSurfaceVariant)
                            else -> {
                                val split = rule.prefix.coerceIn(0, ref.length)
                                androidx.compose.material3.Text(
                                    androidx.compose.ui.text.buildAnnotatedString {
                                        pushStyle(androidx.compose.ui.text.SpanStyle(color = MaterialTheme.colorScheme.primary, fontWeight = FontWeight.Bold))
                                        append(ref.take(split))
                                        pop()
                                        pushStyle(androidx.compose.ui.text.SpanStyle(color = MaterialTheme.colorScheme.onSurfaceVariant))
                                        append(ref.drop(split))
                                        pop()
                                    },
                                    fontFamily = FontFamily.Monospace,
                                    fontSize = 17.sp,
                                )
                                Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
                                    Column(Modifier.weight(1f)) {
                                        Text("Matching: first ${rule.prefix} of ${rule.len} characters", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                                        when (current.source) {
                                            "memory" -> Text("From earlier counts", style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.primary)
                                            "scans" -> Text("Learned from these scans", style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                                            "adjusted" -> Text("Adjusted by you", style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                                        }
                                    }
                                    OutlinedButton(
                                        onClick = { call { setState(container.api.counterAdjust(-1)) } },
                                        enabled = !locked && rule.prefix > 1,
                                        shape = RoundedCornerShape(10.dp),
                                    ) { Text("−") }
                                    Row(Modifier.width(8.dp)) {}
                                    OutlinedButton(
                                        onClick = { call { setState(container.api.counterAdjust(1)) } },
                                        enabled = !locked && rule.prefix < rule.len - 1,
                                        shape = RoundedCornerShape(10.dp),
                                    ) { Text("+") }
                                }
                            }
                        }
                    }
                }

                if (!multi) OutlinedTextField(
                    value = expectedText,
                    onValueChange = { expectedText = it.filter(Char::isDigit).take(4) },
                    label = { Text("Expected colli (optional)") },
                    singleLine = true,
                    enabled = !locked,
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number, imeAction = ImeAction.Done),
                    keyboardActions = KeyboardActions(onDone = { saveExpected() }),
                    shape = RoundedCornerShape(12.dp),
                    modifier = Modifier.fillMaxWidth(),
                )
            }
        }

        if (multi) {
            current.groups.forEach { g ->
                DeliveryCard(
                    group = g,
                    others = current.groups.filter { it.id != g.id },
                    enabled = !locked,
                    onAdjust = { d -> call { setState(container.api.counterGroupAdjust(g.id, d)) } },
                    onExpected = { n -> call { setState(container.api.counterGroupExpected(g.id, n)) } },
                    onJoin = { into -> confirm = "merge:${g.id}:$into" },
                    onRemove = { confirm = "remove:${g.id}" },
                )
            }
        }

        if (!multi && current.noteCompare && current.count > 0 && pending == null) NoteCompareSection(enabled = !locked)

        if (feed.isNotEmpty()) {
            AppCard {
                Column(Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 8.dp)) {
                    feed.forEach { e ->
                        Row(Modifier.fillMaxWidth().padding(vertical = 6.dp), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
                            androidx.compose.material3.Text(e.code, fontFamily = FontFamily.Monospace, modifier = Modifier.weight(1f), maxLines = 1)
                            Pill(
                                e.kind.label,
                                if (e.kind == Kind.Counted) MaterialTheme.colorScheme.primaryContainer else MaterialTheme.colorScheme.surfaceVariant,
                                if (e.kind == Kind.Counted) MaterialTheme.colorScheme.onPrimaryContainer else MaterialTheme.colorScheme.onSurfaceVariant,
                            )
                        }
                    }
                }
            }
        }

        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            OutlinedButton(onClick = { confirm = "undo" }, enabled = !locked && current.count > 0, shape = RoundedCornerShape(10.dp), modifier = Modifier.weight(1f)) { Text("Remove last", maxLines = 1) }
            OutlinedButton(onClick = { confirm = "cancel" }, enabled = !locked && current.active, shape = RoundedCornerShape(10.dp), modifier = Modifier.weight(1f)) { Text("Cancel count", maxLines = 1) }
            Button(onClick = { if (!multi) saveExpected(); confirm = "finish" }, enabled = !locked && current.count > 0, shape = RoundedCornerShape(10.dp), modifier = Modifier.weight(1f)) { Text("Finish", maxLines = 1) }
        }
    }

    when (confirm) {
        "undo" -> ConfirmDialog(
            title = "Remove the last package?",
            text = "The newest scanned package is taken out of the count.",
            confirmLabel = "Yes, remove",
            onConfirm = {
                call {
                    setState(container.api.counterUndo())
                    val i = feed.indexOfFirst { it.kind == Kind.Counted || it.kind == Kind.Forced }
                    if (i >= 0) feed = feed.filterIndexed { j, _ -> j != i }
                    container.signal(Tone.Deleted)
                }
            },
            onDismiss = { confirm = null },
        )
        "cancel" -> ConfirmDialog(
            title = "Cancel this count? All scanned packages are discarded.",
            text = "Nothing is saved.",
            confirmLabel = "Yes, cancel",
            onConfirm = {
                call {
                    setState(container.api.counterCancel())
                    feed = emptyList()
                    container.signal(Tone.Deleted)
                }
            },
            onDismiss = { confirm = null },
        )
        "finish" -> ConfirmDialog(
            title = if (multi) "Finish and save ${current.groups.size} deliveries (${current.groups.joinToString(" + ") { it.count.toString() }} packages)?" else "Finish with ${current.count} colli?",
            text = "Only the number is saved. The package codes are deleted.",
            confirmLabel = "Yes, finish",
            destructive = false,
            onConfirm = {
                call {
                    val done = container.api.counterFinish()
                    result = done
                    setState(CounterState())
                    feed = emptyList()
                    container.signal(Tone.Finished)
                }
            },
            onDismiss = { confirm = null },
        )
    }

    val parts = confirm?.split(":").orEmpty()
    if (parts.firstOrNull() == "remove") {
        ConfirmDialog(
            title = "Remove this delivery and all its scanned packages?",
            text = "Nothing is saved.",
            confirmLabel = "Yes, remove",
            onConfirm = {
                call {
                    setState(container.api.counterGroupRemove(parts[1].toInt()))
                    container.signal(Tone.Deleted)
                }
            },
            onDismiss = { confirm = null },
        )
    }
    if (parts.firstOrNull() == "merge") {
        val from = parts[1].toInt()
        val into = parts[2].toInt()
        ConfirmDialog(
            title = "Join delivery ${current.groups.firstOrNull { it.id == from }?.number} into delivery ${current.groups.firstOrNull { it.id == into }?.number}?",
            text = "Their packages are counted together.",
            confirmLabel = "Yes, join",
            destructive = false,
            onConfirm = { call { setState(container.api.counterGroupMerge(from, into)) } },
            onDismiss = { confirm = null },
        )
    }

    pending?.let { wrong ->
        AlertDialog(
            onDismissRequest = {},
            title = { Text("This package does not belong to this shipment", color = MaterialTheme.colorScheme.error) },
            text = {
                Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                    androidx.compose.material3.Text(wrong, fontFamily = FontFamily.Monospace, fontSize = 17.sp)
                    Button(onClick = { decide("ignore") }, enabled = !busy, modifier = Modifier.fillMaxWidth().height(48.dp), shape = RoundedCornerShape(12.dp)) { Text("Ignore this scan") }
                    OutlinedButton(onClick = { decide("count") }, enabled = !busy, modifier = Modifier.fillMaxWidth().height(48.dp), shape = RoundedCornerShape(12.dp)) { Text("Count it anyway") }
                    if (current.count > 0) {
                        OutlinedButton(onClick = { decide("delivery") }, enabled = !busy, modifier = Modifier.fillMaxWidth().height(48.dp), shape = RoundedCornerShape(12.dp)) { Text("Count as another delivery") }
                        OutlinedButton(onClick = { decide("new") }, enabled = !busy, modifier = Modifier.fillMaxWidth().height(48.dp), shape = RoundedCornerShape(12.dp)) { Text("Save this shipment and start a new one") }
                    }
                }
            },
            confirmButton = {},
        )
    }
}
