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
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.authsignature.app.container
import com.authsignature.app.data.ApiException
import com.authsignature.app.data.StatsBlock
import com.authsignature.app.data.StatsReply
import java.time.LocalDate
import java.time.ZoneId

private class Preset(val name: String, val unit: String, val days: Int, val thisMonth: Boolean = false, val lastMonth: Boolean = false)

private val PRESETS = listOf(
    Preset("Last 7 days", "day", 7),
    Preset("Last 30 days", "day", 30),
    Preset("This month", "day", 0, thisMonth = true),
    Preset("Last month", "day", 0, lastMonth = true),
    Preset("Last 12 weeks", "week", 84),
    Preset("Last 12 months", "month", 365),
)

private fun rangeFor(p: Preset): Pair<String, String> {
    val today = LocalDate.now(ZoneId.of("Europe/Stockholm"))
    return when {
        p.thisMonth -> today.withDayOfMonth(1).toString() to today.toString()
        p.lastMonth -> {
            val first = today.withDayOfMonth(1).minusMonths(1)
            first.toString() to first.plusMonths(1).minusDays(1).toString()
        }
        else -> today.minusDays(p.days - 1L).toString() to today.toString()
    }
}

/** Shipments counted and colli received, by day, week or month, and compared with the period before. */
@OptIn(ExperimentalLayoutApi::class)
@Composable
fun CounterStatsScreen() {
    val container = LocalContext.current.container
    var preset by rememberSaveable { mutableStateOf(0) }
    var mine by rememberSaveable { mutableStateOf(false) }
    var compare by rememberSaveable { mutableStateOf(true) }
    var reply by remember { mutableStateOf<StatsReply?>(null) }
    var error by remember { mutableStateOf<String?>(null) }

    LaunchedEffect(preset, mine, compare) {
        reply = null
        error = null
        val p = PRESETS[preset]
        val (from, to) = rangeFor(p)
        try {
            reply = container.api.counterStats(p.unit, from, to, mine, compare)
        } catch (e: ApiException) {
            if (e.unauthorized) container.signOut() else error = e.message
        }
    }

    Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(horizontal = 16.dp).padding(bottom = 16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
        FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            PRESETS.forEachIndexed { i, p -> FilterChip(selected = preset == i, onClick = { preset = i }, label = { Text(p.name) }) }
        }
        Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.SpaceBetween) {
            Text("Only me")
            Switch(checked = mine, onCheckedChange = { mine = it })
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
                Kpi("Shipments", a.shipments.toString(), b?.shipments?.toString(), a.shipments.toDouble(), b?.shipments?.toDouble())
                Kpi("Colli", a.colli.toString(), b?.colli?.toString(), a.colli.toDouble(), b?.colli?.toDouble())
                Kpi("Colli per shipment", "%.1f".format(a.average), b?.let { "%.1f".format(it.average) }, a.average, b?.average)
                if (a.withExpected > 0) {
                    Text("${a.mismatched} of ${a.withExpected} shipments with an expected number differed from it.", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                }
                ChartCard("Shipments", a, b) { it.shipments }
                ChartCard("Colli", a, b) { it.colli }
            }
        }
    }
}

@Composable
private fun Kpi(title: String, value: String, before: String?, now: Double, then: Double?) {
    AppCard {
        Column(Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 12.dp)) {
            Text(title, style = MaterialTheme.typography.labelMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
            Row(verticalAlignment = Alignment.Bottom, horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                Text(value, style = MaterialTheme.typography.headlineMedium, fontWeight = FontWeight.SemiBold)
                if (then != null) {
                    val pct = if (then == 0.0) null else Math.round((now - then) / then * 100).toInt()
                    val color = when {
                        pct == null || pct == 0 -> MaterialTheme.colorScheme.onSurfaceVariant
                        pct > 0 -> status.success
                        else -> MaterialTheme.colorScheme.error
                    }
                    Text(
                        when {
                            pct == null -> if (now == 0.0) "–" else "new"
                            pct > 0 -> "▲ $pct%"
                            pct < 0 -> "▼ ${-pct}%"
                            else -> "= 0%"
                        },
                        color = color,
                        style = MaterialTheme.typography.labelLarge,
                        modifier = Modifier.padding(bottom = 4.dp),
                    )
                }
            }
            if (before != null) Text("before: $before", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
        }
    }
}

/** Two bars per slot: this period and, lighter, the one it is compared with. */
@Composable
private fun ChartCard(title: String, a: StatsBlock, b: StatsBlock?, pick: (com.authsignature.app.data.StatBucket) -> Int) {
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
