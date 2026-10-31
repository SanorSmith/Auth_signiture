package com.authsignature.app.ui

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Button
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.TextButton
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
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import com.authsignature.app.container
import com.authsignature.app.data.AllowedSupplier
import com.authsignature.app.data.ApiException
import com.authsignature.app.sound.Tone
import kotlinx.coroutines.launch

/**
 * Suppliers whose requests get their code at once, without the administrator confirming each one. The
 * request still stays in the history, where it can be removed.
 */
@Composable
fun AllowListScreen() {
    val container = LocalContext.current.container
    val scope = rememberCoroutineScope()
    var list by remember { mutableStateOf<List<AllowedSupplier>?>(null) }
    var name by remember { mutableStateOf("") }
    var error by remember { mutableStateOf<String?>(null) }
    var busy by remember { mutableStateOf(false) }
    var removing by remember { mutableStateOf<AllowedSupplier?>(null) }

    fun run(tone: Tone, block: suspend () -> List<AllowedSupplier>) {
        busy = true
        error = null
        scope.launch {
            try {
                list = block()
                container.signal(tone)
            } catch (e: ApiException) {
                if (e.unauthorized) container.signOut() else error = e.message
                container.signal(Tone.Error)
            } finally {
                busy = false
            }
        }
    }

    LaunchedEffect(Unit) {
        try {
            list = container.api.allowList()
        } catch (e: ApiException) {
            if (e.unauthorized) container.signOut() else error = e.message
        }
    }

    fun add() {
        val value = name.trim()
        if (value.isEmpty() || busy) return
        run(Tone.Done) {
            val next = container.api.allowAdd(value)
            name = ""
            next
        }
    }

    Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(horizontal = 16.dp).padding(bottom = 16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
        Text(
            "Suppliers on this list get their code at once, without you confirming each request. The request still shows in the history, and you can remove it there.",
            style = MaterialTheme.typography.bodySmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
        )
        AppCard {
            Column(Modifier.fillMaxWidth().padding(16.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                OutlinedTextField(
                    value = name,
                    onValueChange = { name = it.take(36) },
                    label = { Text("Supplier name") },
                    singleLine = true,
                    enabled = !busy,
                    keyboardOptions = KeyboardOptions(imeAction = ImeAction.Done),
                    keyboardActions = KeyboardActions(onDone = { add() }),
                    shape = RoundedCornerShape(12.dp),
                    modifier = Modifier.fillMaxWidth(),
                )
                error?.let { ErrorNote(it) }
                Button(onClick = { add() }, enabled = !busy && name.isNotBlank(), modifier = Modifier.fillMaxWidth().height(48.dp), shape = RoundedCornerShape(12.dp)) { Text("Add") }
                Text(
                    "The name must be written the same way in the request. Capital letters and extra spaces do not matter.",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
        }

        val items = list
        when {
            items == null -> if (error == null) Loading()
            items.isEmpty() -> Text("No suppliers on the list. Every request waits for you.", color = MaterialTheme.colorScheme.onSurfaceVariant)
            else -> AppCard {
                Column(Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 4.dp)) {
                    items.forEach { s ->
                        Row(Modifier.fillMaxWidth().padding(vertical = 4.dp), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
                            Text(s.name, fontWeight = FontWeight.Medium, modifier = Modifier.weight(1f), maxLines = 1, overflow = TextOverflow.Ellipsis)
                            TextButton(onClick = { removing = s }, enabled = !busy) { Text("Remove", color = MaterialTheme.colorScheme.error) }
                        }
                    }
                }
            }
        }
    }

    removing?.let { s ->
        ConfirmDialog(
            title = "Remove this supplier from the list?",
            text = s.name,
            confirmLabel = "Yes, remove",
            onConfirm = { run(Tone.Deleted) { container.api.allowRemove(s.id) } },
            onDismiss = { removing = null },
        )
    }
}
