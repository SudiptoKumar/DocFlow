package com.sudiptokumar.docflow.ui.theme

import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color

private val Light = lightColorScheme(
    primary = Color(0xFF10B981),
    onPrimary = Color.White,
    secondary = Color(0xFFF59E0B),
    onSecondary = Color(0xFF241A00),
    tertiary = Color(0xFF7C3AED),
    onTertiary = Color.White,
    background = Color(0xFFFFFFFF),
    onBackground = Color(0xFF334155),
    surface = Color(0xFFFFFFFF),
    onSurface = Color(0xFF334155),
    surfaceVariant = Color(0xFFF1F5F9),
    onSurfaceVariant = Color(0xFF64748B),
    outline = Color(0xFFE2E8F0)
)

private val Dark = darkColorScheme(
    primary = Color(0xFF19E6C1),
    onPrimary = Color(0xFF00251F),
    secondary = Color(0xFFFFC857),
    onSecondary = Color(0xFF261900),
    tertiary = Color(0xFFB78CFF),
    onTertiary = Color(0xFF1C0A37),
    background = Color.Black,
    onBackground = Color(0xFFF4F4F5),
    surface = Color(0xFF050505),
    onSurface = Color(0xFFF4F4F5),
    surfaceVariant = Color(0xFF0F0F10),
    onSurfaceVariant = Color(0xFFA1A1AA),
    outline = Color(0xFF27272A)
)

@Composable
fun DocFlowTheme(
    darkTheme: Boolean = isSystemInDarkTheme(),
    content: @Composable () -> Unit
) {
    MaterialTheme(
        colorScheme = if (darkTheme) Dark else Light,
        typography = MaterialTheme.typography,
        content = content
    )
}

object DocFlowColors {
    val Green = Color(0xFF10B981)
    val Emerald = Color(0xFF34D399)
    val Teal = Color(0xFF14B8A6)
    val Blue = Color(0xFF3B82F6)
    val Purple = Color(0xFF8B5CF6)
    val Orange = Color(0xFFF59E0B)
    val Pink = Color(0xFFEC4899)
    val Yellow = Color(0xFFFACC15)
    val LightEditor = Color(0xFFFFFEF0)
    val LightWarm = Color(0xFFFFFCF5)
    val DarkEditor = Color.Black
    val DarkCard = Color(0xFF080808)
}
