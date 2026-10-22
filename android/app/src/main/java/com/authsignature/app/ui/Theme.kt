package com.authsignature.app.ui

import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Typography
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.staticCompositionLocalOf
import androidx.compose.ui.graphics.Color

// The same indigo brand as the website, in light and dark.
private val LightColors = lightColorScheme(
    primary = Color(0xFF4F46E5),
    onPrimary = Color.White,
    primaryContainer = Color(0xFFEEF2FF),
    onPrimaryContainer = Color(0xFF312E81),
    secondaryContainer = Color(0xFFEEF2FF),
    onSecondaryContainer = Color(0xFF312E81),
    background = Color(0xFFF5F6F8),
    onBackground = Color(0xFF0F172A),
    surface = Color.White,
    onSurface = Color(0xFF0F172A),
    surfaceVariant = Color(0xFFF1F3F7),
    onSurfaceVariant = Color(0xFF64748B),
    surfaceContainer = Color(0xFFFFFFFF),
    surfaceContainerHigh = Color(0xFFF1F3F7),
    outline = Color(0xFF94A3B8),
    outlineVariant = Color(0xFFE3E6EC),
    error = Color(0xFFDC2626),
    errorContainer = Color(0xFFFEF2F2),
    onErrorContainer = Color(0xFF991B1B),
)

private val DarkColors = darkColorScheme(
    primary = Color(0xFF818CF8),
    onPrimary = Color(0xFF0B0E14),
    primaryContainer = Color(0xFF1B1F3A),
    onPrimaryContainer = Color(0xFFC7D2FE),
    secondaryContainer = Color(0xFF1B1F3A),
    onSecondaryContainer = Color(0xFFC7D2FE),
    background = Color(0xFF0B0E14),
    onBackground = Color(0xFFE6E9EF),
    surface = Color(0xFF131720),
    onSurface = Color(0xFFE6E9EF),
    surfaceVariant = Color(0xFF1B212C),
    onSurfaceVariant = Color(0xFF97A1B3),
    surfaceContainer = Color(0xFF131720),
    surfaceContainerHigh = Color(0xFF1B212C),
    outline = Color(0xFF64748B),
    outlineVariant = Color(0xFF242B38),
    error = Color(0xFFF87171),
    errorContainer = Color(0xFF2B1416),
    onErrorContainer = Color(0xFFFCA5A5),
)

/** Colours the Material scheme has no slot for: success (green) and warning (amber). */
data class StatusColors(val success: Color, val successContainer: Color, val warn: Color, val warnContainer: Color)

private val LightStatus = StatusColors(Color(0xFF15803D), Color(0xFFECFDF3), Color(0xFFB45309), Color(0xFFFFFBEB))
private val DarkStatus = StatusColors(Color(0xFF4ADE80), Color(0xFF0F2A1C), Color(0xFFFBBF24), Color(0xFF2A2108))

val LocalStatus = staticCompositionLocalOf { LightStatus }

val status: StatusColors
    @Composable get() = LocalStatus.current

@Composable
fun AuthTheme(dark: Boolean = isSystemInDarkTheme(), content: @Composable () -> Unit) {
    androidx.compose.runtime.CompositionLocalProvider(LocalStatus provides if (dark) DarkStatus else LightStatus) {
        MaterialTheme(colorScheme = if (dark) DarkColors else LightColors, typography = Typography(), content = content)
    }
}
