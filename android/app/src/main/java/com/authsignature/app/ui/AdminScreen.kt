package com.authsignature.app.ui

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Button
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.ButtonDefaults
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import com.authsignature.app.container
import com.authsignature.app.data.ApiException
import com.authsignature.app.data.IssuedRequest
import com.authsignature.app.data.PendingRequest
import com.authsignature.app.sound.Tone
import kotlinx.coroutines.launch

/** Requests waiting for a code, the last three issued, and the actions on them. */
@Composable
fun AdminScreen() {
    val container = LocalContext.current.container
    val scope = rememberCoroutineScope()
    val remote = rememberRemote(everyMs = 5000) { container.api.admin() }
    var error by remember { mutableStateOf<String?>(null) }
    var denying by remember { mutableStateOf<PendingRequest?>(null) }
    var removing by remember { mutableStateOf<IssuedRequest?>(null) }

    // A client just scanned something: show it at once instead of waiting for the next refresh.
    LaunchedEffect(Unit) { container.poller.events.collect { remote.refresh() } }

    fun act(tone: Tone, block: suspend () -> Unit) {
        error = null
        scope.launch {
            try {
                block()
                container.signal(tone)
            } catch (e: ApiException) {
                if (e.unauthorized) container.signOut() else error = e.message
                container.signal(Tone.Error)
            }
            remote.refresh()
        }
    }

    Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
        val state = remote.data
        if (state == null) {
            if (remote.error != null) ErrorNote(remote.error!!) else Loading()
            return@Column
        }
        error?.let { ErrorNote(it) }

        Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
            Tile("Pending", state.pending.size.toString(), Modifier.weight(1f), if (state.pending.isNotEmpty()) status.warn else MaterialTheme.colorScheme.onSurface)
            Tile("Codes issued", state.totals.issued.toString(), Modifier.weight(1f))
            state.totals.resets?.let {
                Tile("Resets", it.toString(), Modifier.weight(1f), if (it > 0) MaterialTheme.colorScheme.error else MaterialTheme.colorScheme.onSurface)
            }
        }

        SectionTitle("Pending requests")
        if (state.pending.isEmpty()) EmptyNote("Nothing waiting. New scans appear here.")
        state.pending.forEach { r ->
            PendingCard(r, onGenerate = { act(Tone.Done) { container.api.issue(r.id) } }, onDeny = { denying = r })
        }

        SectionTitle("Last 3 issued")
        if (state.issued.isEmpty()) EmptyNote("Nothing issued yet.")
        state.issued.forEach { r -> IssuedCard(r, onRemove = { removing = r }) }
    }

    denying?.let { r ->
        ConfirmDialog(
            title = "Deny this request?",
            text = "${r.askedBy ?: "The client"} will be told it was denied. They can scan the number again to ask once more.",
            confirmLabel = "Yes, deny",
            onConfirm = { act(Tone.Deleted) { container.api.deny(r.id) } },
            onDismiss = { denying = null },
        )
    }
    removing?.let { r ->
        ConfirmDialog(
            title = "Remove this request?",
            text = "Its code ${r.vcode} stops working on the monitor and leaves the client's history. This cannot be undone.",
            confirmLabel = "Yes, remove",
            onConfirm = { act(Tone.Deleted) { container.api.remove(r.id) } },
            onDismiss = { removing = null },
        )
    }
}

@Composable
private fun PendingCard(r: PendingRequest, onGenerate: () -> Unit, onDeny: () -> Unit) {
    var expanded by remember { mutableStateOf(false) }
    AppCard {
        Column {
            Column(Modifier.clickable { expanded = !expanded }.padding(16.dp)) {
                Text(
                    r.number ?: "Number not stored",
                    fontFamily = FontFamily.Monospace,
                    fontWeight = FontWeight.Bold,
                    style = MaterialTheme.typography.titleLarge,
                )
                Text(
                    "Asked by ${r.askedBy ?: "Unknown"} · ${clock(r.at)}",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                )
                if (r.note != null) {
                    Spacer(Modifier.height(6.dp))
                    NoteBadge()
                }
            }
            if (expanded) {
                HorizontalDivider(color = MaterialTheme.colorScheme.outlineVariant)
                Column(Modifier.fillMaxWidth().padding(16.dp), verticalArrangement = Arrangement.spacedBy(2.dp)) {
                    Text("Client note", style = MaterialTheme.typography.labelMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
                    Text(r.note ?: "No note.", color = if (r.note == null) MaterialTheme.colorScheme.onSurfaceVariant else MaterialTheme.colorScheme.onSurface)
                }
            }
            HorizontalDivider(color = MaterialTheme.colorScheme.outlineVariant)
            Row(Modifier.fillMaxWidth().padding(12.dp), horizontalArrangement = Arrangement.End, verticalAlignment = Alignment.CenterVertically) {
                OutlinedButton(
                    onClick = onDeny,
                    colors = ButtonDefaults.outlinedButtonColors(contentColor = MaterialTheme.colorScheme.error),
                    shape = RoundedCornerShape(10.dp),
                ) { Text("Deny") }
                Spacer(Modifier.width(8.dp))
                Button(onClick = onGenerate, shape = RoundedCornerShape(10.dp)) { Text("Generate") }
            }
        }
    }
}

@Composable
private fun IssuedCard(r: IssuedRequest, onRemove: () -> Unit) {
    var expanded by remember { mutableStateOf(false) }
    AppCard {
        Column {
            Row(Modifier.clickable { expanded = !expanded }.padding(16.dp), verticalAlignment = Alignment.CenterVertically) {
                Column(Modifier.weight(1f)) {
                    Text("Asked by ${r.askedBy ?: "Unknown"}", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant, maxLines = 1, overflow = TextOverflow.Ellipsis)
                    Text("Issued by ${r.issuedBy ?: "Unknown"}", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant, maxLines = 1, overflow = TextOverflow.Ellipsis)
                    Text(clock(r.at), style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                    if (r.note != null) {
                        Spacer(Modifier.height(6.dp))
                        NoteBadge()
                    }
                }
                Spacer(Modifier.width(12.dp))
                Text(r.vcode, fontFamily = FontFamily.Monospace, fontWeight = FontWeight.SemiBold, style = MaterialTheme.typography.titleLarge)
            }
            if (expanded) {
                HorizontalDivider(color = MaterialTheme.colorScheme.outlineVariant)
                Column(Modifier.fillMaxWidth().padding(16.dp), verticalArrangement = Arrangement.spacedBy(2.dp)) {
                    Text("Client note", style = MaterialTheme.typography.labelMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
                    Text(r.note ?: "No note.", color = if (r.note == null) MaterialTheme.colorScheme.onSurfaceVariant else MaterialTheme.colorScheme.onSurface)
                }
            }
            HorizontalDivider(color = MaterialTheme.colorScheme.outlineVariant)
            Row(Modifier.fillMaxWidth().padding(12.dp), horizontalArrangement = Arrangement.End) {
                OutlinedButton(
                    onClick = onRemove,
                    colors = ButtonDefaults.outlinedButtonColors(contentColor = MaterialTheme.colorScheme.error),
                    shape = RoundedCornerShape(10.dp),
                ) { Text("Remove") }
            }
        }
    }
}

@Composable
private fun NoteBadge() {
    Surface(shape = RoundedCornerShape(50), color = MaterialTheme.colorScheme.primaryContainer) {
        Text("Note", modifier = Modifier.padding(horizontal = 10.dp, vertical = 2.dp), style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onPrimaryContainer)
    }
}
