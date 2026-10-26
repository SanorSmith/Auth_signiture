package com.authsignature.app.ui

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Button
import androidx.compose.material3.MaterialTheme
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
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import com.authsignature.app.container
import com.authsignature.app.data.ApiException
import com.authsignature.app.scan.ScanBus
import com.authsignature.app.sound.Tone
import kotlinx.coroutines.launch

private sealed interface Lookup {
    data object Idle : Lookup
    data object Busy : Lookup
    data class Found(val vcode: String) : Lookup
    data class Missing(val message: String) : Lookup
    data class Failed(val message: String) : Lookup
}

/** Scan a number and see its verification code, with a short sound that says whether it was found. */
@Composable
fun MonitorScreen() {
    val container = LocalContext.current.container
    val scope = rememberCoroutineScope()
    val focus = remember { FocusRequester() }
    var number by remember { mutableStateOf("") }
    var result by remember { mutableStateOf<Lookup>(Lookup.Idle) }

    fun lookup(code: String) {
        if (result is Lookup.Busy) return
        if (code.length != 10) {
            result = Lookup.Failed("Not a valid 10-digit number")
            container.signal(Tone.Error)
            return
        }
        result = Lookup.Busy
        scope.launch {
            try {
                result = Lookup.Found(container.api.lookup(code))
                container.signal(Tone.Found)
            } catch (e: ApiException) {
                when {
                    e.unauthorized -> container.signOut()
                    e.code == "not_issued" -> {
                        result = Lookup.Missing(e.message)
                        container.signal(Tone.Missing)
                    }
                    else -> {
                        result = Lookup.Failed(e.message)
                        container.signal(Tone.Error)
                    }
                }
            } finally {
                number = ""
                runCatching { focus.requestFocus() }
            }
        }
    }

    LaunchedEffect(Unit) {
        ScanBus.scans.collect { raw ->
            val digits = raw.filter(Char::isDigit).take(10)
            number = digits
            lookup(digits)
        }
    }

    Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
        // The result sits above the scan box, so a scan and its answer are both on screen.
        val found = result as? Lookup.Found
        AppCard(
            container = if (found != null) status.successContainer else MaterialTheme.colorScheme.surface,
            border = if (found != null) status.success.copy(alpha = 0.4f) else MaterialTheme.colorScheme.outlineVariant,
        ) {
            Column(
                Modifier.fillMaxWidth().heightIn(min = 170.dp).padding(16.dp),
                verticalArrangement = Arrangement.Center,
                horizontalAlignment = Alignment.CenterHorizontally,
            ) {
                when (val r = result) {
                    Lookup.Idle -> Text("Ready. Waiting for a scan…", color = MaterialTheme.colorScheme.onSurfaceVariant)
                    Lookup.Busy -> Text("Looking up…", color = MaterialTheme.colorScheme.onSurfaceVariant)
                    is Lookup.Found -> {
                        Text("VERIFICATION CODE", style = MaterialTheme.typography.labelMedium, color = status.success)
                        CodeText(r.vcode, status.success, maxSize = 96f)
                    }
                    is Lookup.Missing -> {
                        Text("NOT AVAILABLE", style = MaterialTheme.typography.labelMedium, color = status.warn)
                        Text(r.message, style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Medium, textAlign = TextAlign.Center)
                    }
                    is Lookup.Failed -> {
                        Text("ERROR", style = MaterialTheme.typography.labelMedium, color = MaterialTheme.colorScheme.error)
                        Text(r.message, style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Medium, textAlign = TextAlign.Center)
                    }
                }
            }
        }

        AppCard {
            Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
                ScanNumberField(number, { number = it }, { lookup(number) }, focus)
                Button(
                    onClick = { lookup(number) },
                    enabled = result !is Lookup.Busy,
                    modifier = Modifier.fillMaxWidth().height(50.dp),
                    shape = RoundedCornerShape(12.dp),
                ) { Text("Show code") }
            }
        }
    }
}
