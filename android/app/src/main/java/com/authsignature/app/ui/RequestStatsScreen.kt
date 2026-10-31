package com.authsignature.app.ui

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.FilterChip
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Switch
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import com.authsignature.app.container
import com.authsignature.app.data.ApiException
import com.authsignature.app.data.RequestBucket
import com.authsignature.app.data.RequestStatsBlock
import com.authsignature.app.data.RequestStatsReply

/** The Requests tab: the waiting requests, and (for administrators) the statistics of the requests. */
@Composable
fun RequestsTab(isAdmin: Boolean) {
    var page by rememberSaveable { mutableStateOf(0) }
    Column(Modifier.fillMaxSize()) {
        if (isAdmin) {
            Row(Modifier.padding(horizontal = 16.dp, vertical = 8.dp), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                FilterChip(selected = page == 0, onClick = { page = 0 }, label = { Text("Requests") })
                FilterChip(selected = page == 1, onClick = { page = 1 }, label = { Text("Statistics") })
            }
        }
        if (page == 0 || !isAdmin) AdminScreen() else RequestStatsScreen()
    }
}

/** Codes requested, issued and denied, by day, week or month, and compared with the period before. */
@OptIn(ExperimentalLayoutApi::class)
@Composable
fun RequestStatsScreen() {
    val container = LocalContext.current.container
    var preset by rememberSaveable { mutableStateOf(0) }
    var compare by rememberSaveable { mutableStateOf(true) }
    var reply by remember { mutableStateOf<RequestStatsReply?>(null) }
    var error by remember { mutableStateOf<String?>(null) }

    LaunchedEffect(preset, compare) {
        reply = null
        error = null
        val p = PRESETS[preset]
        val (from, to) = rangeFor(p)
        try {
            reply = container.api.requestStats(p.unit, from, to, compare)
        } catch (e: ApiException) {
            if (e.unauthorized) container.signOut() else error = e.message
        }
    }

    Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(horizontal = 16.dp).padding(bottom = 16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
        FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            PRESETS.forEachIndexed { i, p -> FilterChip(selected = preset == i, onClick = { preset = i }, label = { Text(p.name) }) }
        }
        Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.SpaceBetween) {
            Text("Compare with the previous period")
            Switch(checked = compare, onCheckedChange = { compare = it })
        }

        val data = reply
        when {
            error != null -> ErrorNote(error!!)
            data == null -> Loading()
            else -> {
                val a = data.current
                val b = data.compare
                Text("${a.from} – ${a.to}", style = MaterialTheme.typography.labelMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
                Kpi("Requested", a.requested.toString(), b?.requested?.toString(), a.requested.toDouble(), b?.requested?.toDouble())
                Kpi("Codes issued", a.issued.toString(), b?.issued?.toString(), a.issued.toDouble(), b?.issued?.toDouble())
                Kpi("Denied requests", a.denied.toString(), b?.denied?.toString(), a.denied.toDouble(), b?.denied?.toDouble())
                Text("${a.waiting} waiting for a code right now.", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                BarsCard("Requested", a, b) { it.requested }
                BarsCard("Codes issued", a, b) { it.issued }
                BarsCard("Denied requests", a, b) { it.denied }
                if (a.requesters.isNotEmpty()) {
                    AppCard {
                        Column(Modifier.fillMaxWidth().padding(16.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                            Text("Who asked for the most codes", style = MaterialTheme.typography.titleSmall, fontWeight = FontWeight.SemiBold)
                            a.requesters.forEach { r ->
                                Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
                                    Text(r.email, modifier = Modifier.weight(1f), maxLines = 1, overflow = TextOverflow.Ellipsis)
                                    Text(r.requested.toString(), fontFamily = FontFamily.Monospace, fontWeight = FontWeight.Bold)
                                }
                            }
                        }
                    }
                }
                Text(
                    "Counted from the requests that exist now: a request an administrator removed is not included.",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
        }
    }
}

/** Two bars per slot: this period and, lighter, the one it is compared with. */
@Composable
private fun BarsCard(title: String, a: RequestStatsBlock, b: RequestStatsBlock?, pick: (RequestBucket) -> Int) {
    val primary = MaterialTheme.colorScheme.primary
    val faded = MaterialTheme.colorScheme.outline.copy(alpha = 0.5f)
    val slots = maxOf(a.buckets.size, b?.buckets?.size ?: 0)
    val max = maxOf(1, a.buckets.maxOfOrNull(pick) ?: 0, b?.buckets?.maxOfOrNull(pick) ?: 0)
    AppCard {
        Column(Modifier.fillMaxWidth().padding(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            Text(title, style = MaterialTheme.typography.titleSmall, fontWeight = FontWeight.SemiBold)
            Canvas(Modifier.fillMaxWidth().height(140.dp)) {
                if (slots == 0) return@Canvas
                val slotW = size.width / slots
                val barW = (slotW * 0.8f) / (if (b != null) 2 else 1)
                for (i in 0 until slots) {
                    val x0 = i * slotW + slotW * 0.1f
                    b?.buckets?.getOrNull(i)?.let {
                        val h = size.height * pick(it) / max
                        drawRoundRect(faded, Offset(x0, size.height - h), Size(barW, h), CornerRadius(3f, 3f))
                    }
                    a.buckets.getOrNull(i)?.let {
                        val h = size.height * pick(it) / max
                        drawRoundRect(primary, Offset(x0 + if (b != null) barW else 0f, size.height - h), Size(barW, h), CornerRadius(3f, 3f))
                    }
                }
            }
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                Text(a.buckets.firstOrNull()?.start?.drop(5) ?: "", style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                Text(a.buckets.lastOrNull()?.start?.drop(5) ?: "", style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
            }
        }
    }
}
