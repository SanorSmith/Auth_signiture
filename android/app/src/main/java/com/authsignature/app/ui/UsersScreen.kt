package com.authsignature.app.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.text.selection.SelectionContainer
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.Checkbox
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Surface
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalClipboardManager
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.AnnotatedString
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import com.authsignature.app.container
import com.authsignature.app.data.ApiException
import com.authsignature.app.data.ManagedUser
import com.authsignature.app.data.Permissions
import com.authsignature.app.data.UsersState
import com.authsignature.app.sound.Tone
import kotlinx.coroutines.launch

/** Who has an account, what each person may do, and the actions the signed-in person may take on them. */
@OptIn(ExperimentalLayoutApi::class)
@Composable
fun UsersScreen() {
    val container = LocalContext.current.container
    val scope = rememberCoroutineScope()
    val remote = rememberRemote(everyMs = 10_000) { container.api.users() }
    var creating by remember { mutableStateOf(false) }
    var editing by remember { mutableStateOf<ManagedUser?>(null) }
    var deleting by remember { mutableStateOf<ManagedUser?>(null) }
    var temporary by remember { mutableStateOf<Pair<String, String>?>(null) }
    var message by remember { mutableStateOf<String?>(null) }
    var error by remember { mutableStateOf<String?>(null) }

    /** Runs an action, plays its sound, and reloads the list. Returns the error text, if any. */
    fun act(tone: Tone, block: suspend () -> Unit, onDone: () -> Unit = {}) {
        error = null
        message = null
        scope.launch {
            try {
                block()
                container.signal(tone)
                onDone()
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
        message?.let { SuccessNote(it) }

        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
            Text("All users (${state.users.size})", style = MaterialTheme.typography.titleSmall, fontWeight = FontWeight.SemiBold)
            if (state.canCreate) {
                Button(onClick = { creating = true }, shape = RoundedCornerShape(10.dp)) {
                    Icon(Icons.Filled.Add, contentDescription = null, modifier = Modifier.size(18.dp))
                    Spacer(Modifier.width(6.dp))
                    Text("Add user")
                }
            }
        }

        state.users.forEach { u ->
            AppCard(border = if (u.resetRequested) MaterialTheme.colorScheme.error.copy(alpha = 0.5f) else MaterialTheme.colorScheme.outlineVariant) {
                Column(Modifier.padding(14.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Box(Modifier.size(40.dp).background(MaterialTheme.colorScheme.primaryContainer, CircleShape), contentAlignment = Alignment.Center) {
                            Text(u.email.take(1).uppercase(), color = MaterialTheme.colorScheme.primary, fontWeight = FontWeight.SemiBold)
                        }
                        Spacer(Modifier.width(12.dp))
                        Column(Modifier.weight(1f)) {
                            Text(u.email, fontWeight = FontWeight.Medium, maxLines = 1, overflow = androidx.compose.ui.text.style.TextOverflow.Ellipsis)
                            Text(
                                "Created ${java.text.SimpleDateFormat("yyyy-MM-dd", java.util.Locale.getDefault()).format(java.util.Date(u.createdAt))}${if (u.isSelf) " · You" else ""}",
                                style = MaterialTheme.typography.bodySmall,
                                color = MaterialTheme.colorScheme.onSurfaceVariant,
                            )
                        }
                    }
                    FlowRow(horizontalArrangement = Arrangement.spacedBy(6.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                        if (u.isAdmin) Pill("Administrator", MaterialTheme.colorScheme.primaryContainer, MaterialTheme.colorScheme.onPrimaryContainer)
                        else {
                            u.perms.forEach { Pill(Permissions.label(it), MaterialTheme.colorScheme.surfaceVariant, MaterialTheme.colorScheme.onSurfaceVariant) }
                            if (u.perms.isEmpty()) Pill("No access", MaterialTheme.colorScheme.surfaceVariant, MaterialTheme.colorScheme.onSurfaceVariant)
                        }
                        if (u.resetRequested) Pill("Reset requested", MaterialTheme.colorScheme.error, MaterialTheme.colorScheme.onError)
                    }
                    if (u.canEdit || u.canReset || u.canDelete) {
                        FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                            if (u.canEdit) OutlinedButton(onClick = { editing = u }, shape = RoundedCornerShape(10.dp)) { Text("Edit") }
                            if (u.canReset) {
                                OutlinedButton(
                                    onClick = {
                                        act(Tone.Done, {
                                            val result = container.api.resetPassword(u.id)
                                            temporary = u.email to result.code.orEmpty()
                                        })
                                    },
                                    shape = RoundedCornerShape(10.dp),
                                ) { Text("Reset password") }
                            }
                            if (u.canDelete) {
                                OutlinedButton(
                                    onClick = { deleting = u },
                                    shape = RoundedCornerShape(10.dp),
                                    colors = androidx.compose.material3.ButtonDefaults.outlinedButtonColors(contentColor = MaterialTheme.colorScheme.error),
                                ) { Text("Delete") }
                            }
                        }
                    }
                }
            }
        }
    }

    if (creating) {
        val state = remote.data
        UserDialog(
            title = "Add user",
            initial = null,
            options = state?.grantable.orEmpty(),
            adminAllowed = state?.adminAllowed == true,
            onDismiss = { creating = false },
            onSubmit = { email, password, admin, perms ->
                act(Tone.Done, {
                    container.api.createUser(email, password, admin, perms)
                    message = "Created $email. They choose a new password at first sign-in."
                })
                creating = false
            },
        )
    }
    editing?.let { u ->
        UserDialog(
            title = "Edit user",
            initial = u,
            options = Permissions.all.map { it.first },
            adminAllowed = true,
            onDismiss = { editing = null },
            onSubmit = { email, _, admin, perms ->
                act(Tone.Done, { container.api.updateUser(u.id, email, admin, perms) })
                editing = null
            },
        )
    }
    deleting?.let { u ->
        ConfirmDialog(
            title = "Delete this user?",
            text = "${u.email} will be signed out and lose access. Their requests stay on record.",
            confirmLabel = "Yes, delete",
            onConfirm = { act(Tone.Deleted, { container.api.deleteUser(u.id) }) },
            onDismiss = { deleting = null },
        )
    }
    temporary?.let { (email, password) ->
        val clipboard = LocalClipboardManager.current
        AlertDialog(
            onDismissRequest = { temporary = null },
            title = { Text("Temporary password") },
            text = {
                Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                    Text("Give this to $email. It is shown only once, and they must choose a new password when they sign in.")
                    SelectionContainer {
                        Surface(shape = RoundedCornerShape(10.dp), color = status.successContainer) {
                            Text(password, Modifier.fillMaxWidth().padding(14.dp), fontFamily = FontFamily.Monospace, fontWeight = FontWeight.Bold, color = status.success, style = MaterialTheme.typography.titleLarge)
                        }
                    }
                }
            },
            confirmButton = { Button(onClick = { clipboard.setText(AnnotatedString(password)) }) { Text("Copy") } },
            dismissButton = { TextButton(onClick = { temporary = null }) { Text("Done") } },
        )
    }
}

@Composable
private fun Pill(text: String, container: androidx.compose.ui.graphics.Color, content: androidx.compose.ui.graphics.Color) {
    Surface(shape = RoundedCornerShape(50), color = container) {
        Text(text, modifier = Modifier.padding(horizontal = 10.dp, vertical = 3.dp), style = MaterialTheme.typography.labelSmall, color = content)
    }
}

/** One checkbox with a title and a hint. */
@Composable
private fun CheckRow(label: String, hint: String, checked: Boolean, enabled: Boolean, onChange: (Boolean) -> Unit) {
    Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.Top) {
        Checkbox(checked = checked, onCheckedChange = onChange, enabled = enabled)
        Column(Modifier.padding(top = 12.dp)) {
            Text(label, style = MaterialTheme.typography.bodyMedium, fontWeight = FontWeight.Medium)
            Text(hint, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
        }
    }
}

/** Create (initial = null) or edit a user: email, password (new users only) and what they may do. */
@Composable
private fun UserDialog(
    title: String,
    initial: ManagedUser?,
    options: List<String>,
    adminAllowed: Boolean,
    onDismiss: () -> Unit,
    onSubmit: (email: String, password: String, admin: Boolean, perms: List<String>) -> Unit,
) {
    var email by remember { mutableStateOf(initial?.email.orEmpty()) }
    var password by remember { mutableStateOf("") }
    var admin by remember { mutableStateOf(initial?.isAdmin == true) }
    var chosen by remember { mutableStateOf(initial?.perms?.toSet() ?: emptySet()) }
    val creating = initial == null

    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text(title) },
        text = {
            Column(Modifier.heightIn(max = 460.dp).verticalScroll(rememberScrollState()), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                OutlinedTextField(
                    value = email,
                    onValueChange = { email = it },
                    label = { Text("Email") },
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth(),
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Email),
                )
                if (creating) PasswordField("Initial password (min 8)", password, { password = it })
                Text("Permissions", style = MaterialTheme.typography.labelLarge, modifier = Modifier.padding(top = 6.dp))
                if (adminAllowed) {
                    CheckRow("Administrator", "Full access, including editing permissions", admin, enabled = initial?.isSelf != true) { admin = it }
                }
                Permissions.all.filter { it.first in options }.forEach { (key, texts) ->
                    CheckRow(texts.first, texts.second, admin || key in chosen, enabled = !admin) { on ->
                        chosen = if (on) chosen + key else chosen - key
                    }
                }
            }
        },
        confirmButton = {
            Button(onClick = { onSubmit(email.trim(), password, admin, if (admin) emptyList() else chosen.toList()) }, enabled = email.isNotBlank() && (!creating || password.length >= 8)) {
                Text(if (creating) "Create user" else "Save")
            }
        },
        dismissButton = { TextButton(onClick = onDismiss) { Text("Cancel") } },
    )
}
