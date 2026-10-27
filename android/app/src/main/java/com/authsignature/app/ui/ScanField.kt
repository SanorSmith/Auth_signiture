package com.authsignature.app.ui

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.focus.onFocusChanged
import androidx.compose.ui.platform.LocalSoftwareKeyboardController
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

/**
 * The 10-digit number box. It keeps focus so a keyboard-type scanner can type into it, and it does
 * not bring up the on-screen keyboard unless "Type with keyboard" is switched on, so the keyboard never
 * covers the screen on a handheld. Enter (the scanner's suffix) submits.
 */
@Composable
fun ScanNumberField(
    value: String,
    onValueChange: (String) -> Unit,
    onSubmit: () -> Unit,
    focusRequester: FocusRequester,
    modifier: Modifier = Modifier,
    label: String = "10-digit number",
    digitsOnly: Boolean = true,
    maxLength: Int = 10,
    enabled: Boolean = true,
) {
    val keyboard = LocalSoftwareKeyboardController.current
    var manual by remember { mutableStateOf(false) }

    LaunchedEffect(Unit) { runCatching { focusRequester.requestFocus() } }

    Column(modifier, verticalArrangement = Arrangement.spacedBy(2.dp)) {
        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
            Text(label, style = MaterialTheme.typography.labelMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
            TextButton(onClick = {
                manual = !manual
                runCatching { focusRequester.requestFocus() }
                if (manual) keyboard?.show() else keyboard?.hide()
            }) { Text(if (manual) "Hide keyboard" else "Type with keyboard") }
        }
        OutlinedTextField(
            value = value,
            onValueChange = { onValueChange((if (digitsOnly) it.filter(Char::isDigit) else it.filter(Char::isLetterOrDigit).uppercase()).take(maxLength)) },
            enabled = enabled,
            singleLine = true,
            placeholder = { Text("Scan the number", modifier = Modifier.fillMaxWidth(), textAlign = TextAlign.Center) },
            textStyle = TextStyle(fontFamily = FontFamily.Monospace, fontSize = 22.sp, letterSpacing = 3.sp, textAlign = TextAlign.Center),
            shape = RoundedCornerShape(12.dp),
            keyboardOptions = KeyboardOptions(keyboardType = if (digitsOnly) KeyboardType.Number else KeyboardType.Text, imeAction = ImeAction.Send),
            keyboardActions = KeyboardActions(onSend = { onSubmit() }, onDone = { onSubmit() }),
            modifier = Modifier
                .fillMaxWidth()
                .focusRequester(focusRequester)
                .onFocusChanged { if (it.isFocused && !manual) keyboard?.hide() },
        )
    }
}
