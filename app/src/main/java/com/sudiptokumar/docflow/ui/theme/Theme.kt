package com.sudiptokumar.docflow.ui.theme

import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.ui.graphics.Color

private val Light = lightColorScheme(primary = Color(5,150,105), secondary = Color(20,184,166), tertiary = Color(99,102,241))
private val Dark = darkColorScheme(primary = Color(52,211,153), secondary = Color(45,212,191), tertiary = Color(129,140,248))

@Composable
fun DocFlowTheme(darkTheme: Boolean = isSystemInDarkTheme(), content: @Composable () -> Unit) {
    MaterialTheme(colorScheme = if (darkTheme) Dark else Light, typography = MaterialTheme.typography, content = content)
}
