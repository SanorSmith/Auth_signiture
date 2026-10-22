package com.authsignature.app.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import com.authsignature.app.container
import kotlinx.coroutines.delay

/** What happened that concerns this person. Opening it counts as reading it. */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun NotificationsSheet(onDismiss: () -> Unit, onOpen: (String) -> Unit) {
    val container = LocalContext.current.container
    val items by container.poller.items.collectAsState()
    val unread by container.poller.unread.collectAsState()

    LaunchedEffect(unread) {
        if (unread > 0) {
            delay(1500)
            runCatching { container.poller.markAllRead() }
        }
    }

    ModalBottomSheet(onDismissRequest = onDismiss) {
        Column(Modifier.fillMaxWidth().verticalScroll(rememberScrollState()).padding(horizontal = 20.dp).padding(bottom = 24.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
            Text("Notifications", style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.SemiBold)
            if (items.isEmpty()) EmptyNote("Nothing yet. New activity shows up here.", Modifier.padding(top = 8.dp))
            items.take(5).forEach { n ->
                Row(
                    Modifier.fillMaxWidth().clickable { onOpen(n.url) }.padding(vertical = 6.dp),
                    verticalAlignment = Alignment.Top,
                ) {
                    val dot: Color = when (n.kind) {
                        "new_request", "access_changed" -> MaterialTheme.colorScheme.primary
                        "reset_requested" -> status.warn
                        "code_issued" -> status.success
                        "request_denied" -> MaterialTheme.colorScheme.error
                        else -> MaterialTheme.colorScheme.outline
                    }
                    Box(Modifier.padding(top = 6.dp).size(9.dp).background(dot.copy(alpha = if (n.read) 0.4f else 1f), CircleShape))
                    Column(Modifier.padding(start = 12.dp).weight(1f)) {
                        Text(n.title, fontWeight = if (n.read) FontWeight.Normal else FontWeight.SemiBold, maxLines = 1, overflow = TextOverflow.Ellipsis)
                        Text("${n.body.take(60)} · ${ago(n.at)}", maxLines = 1, overflow = TextOverflow.Ellipsis, style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                    }
                    Box(Modifier.width(4.dp))
                }
            }
        }
    }
}
