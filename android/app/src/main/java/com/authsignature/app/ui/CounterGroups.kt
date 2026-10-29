package com.authsignature.app.ui

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.focus.onFocusChanged
import androidx.compose.ui.text.SpanStyle
import androidx.compose.ui.text.buildAnnotatedString
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.authsignature.app.data.CounterGroup
import androidx.compose.material3.Text as MaterialText

/**
 * One delivery in a count of several: its packages, the shared part of their codes (with − and + to
 * change how much must match), an optional expected number, joining into another delivery, and removing it.
 */
@Composable
fun DeliveryCard(
    group: CounterGroup,
    others: List<CounterGroup>,
    enabled: Boolean,
    onAdjust: (Int) -> Unit,
    onExpected: (Int?) -> Unit,
    onJoin: (Int) -> Unit,
    onRemove: () -> Unit,
) {
    var expectedText by remember(group.id, group.expected) { mutableStateOf(group.expected?.toString() ?: "") }
    var menu by remember { mutableStateOf(false) }

    fun saveExpected() {
        val n = expectedText.toIntOrNull()?.takeIf { it in 1..9999 }
        if (n != group.expected) onExpected(n)
    }

    AppCard {
        Column(Modifier.fillMaxWidth().padding(16.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
                Text("Delivery ${group.number}", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.SemiBold)
                Text(
                    group.count.toString(),
                    fontSize = 40.sp,
                    fontWeight = FontWeight.Bold,
                    fontFamily = FontFamily.Monospace,
                    color = if (group.expected != null && group.count == group.expected) com.authsignature.app.ui.status.success else MaterialTheme.colorScheme.primary,
                )
            }

            val ref = group.reference
            val rule = group.rule
            if (ref != null && rule == null) {
                Text("Scan one more package of this delivery. The shipment part of the code is worked out from it.", color = MaterialTheme.colorScheme.onSurfaceVariant, style = MaterialTheme.typography.bodySmall)
            }
            if (ref != null && rule != null) {
                val split = rule.prefix.coerceIn(0, ref.length)
                MaterialText(
                    buildAnnotatedString {
                        pushStyle(SpanStyle(color = MaterialTheme.colorScheme.primary, fontWeight = FontWeight.Bold))
                        append(ref.take(split))
                        pop()
                        pushStyle(SpanStyle(color = MaterialTheme.colorScheme.onSurfaceVariant))
                        append(ref.drop(split))
                        pop()
                    },
                    fontFamily = FontFamily.Monospace,
                    fontSize = 16.sp,
                )
                Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
                    Text(
                        "Matching: first ${rule.prefix} of ${rule.len} characters",
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                        modifier = Modifier.weight(1f),
                    )
                    OutlinedButton(onClick = { onAdjust(-1) }, enabled = enabled && rule.prefix > 1, shape = RoundedCornerShape(10.dp)) { Text("−") }
                    Box(Modifier.width(8.dp))
                    OutlinedButton(onClick = { onAdjust(1) }, enabled = enabled && rule.prefix < rule.len - 1, shape = RoundedCornerShape(10.dp)) { Text("+") }
                }
            }

            OutlinedTextField(
                value = expectedText,
                onValueChange = { expectedText = it.filter(Char::isDigit).take(4) },
                label = { Text("Expected colli (optional)") },
                singleLine = true,
                enabled = enabled,
                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number, imeAction = ImeAction.Done),
                keyboardActions = KeyboardActions(onDone = { saveExpected() }),
                shape = RoundedCornerShape(12.dp),
                modifier = Modifier.fillMaxWidth().onFocusChanged { if (!it.isFocused) saveExpected() },
            )

            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.CenterVertically) {
                if (others.isNotEmpty()) {
                    Box {
                        OutlinedButton(onClick = { menu = true }, enabled = enabled, shape = RoundedCornerShape(10.dp)) { Text("Join into…") }
                        DropdownMenu(expanded = menu, onDismissRequest = { menu = false }) {
                            others.forEach { o ->
                                DropdownMenuItem(text = { Text("Delivery ${o.number}") }, onClick = {
                                    menu = false
                                    onJoin(o.id)
                                })
                            }
                        }
                    }
                }
                Box(Modifier.weight(1f))
                TextButton(onClick = onRemove, enabled = enabled) { Text("Remove delivery", color = MaterialTheme.colorScheme.error) }
            }
        }
    }
}
