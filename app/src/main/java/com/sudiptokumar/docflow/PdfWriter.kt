package com.sudiptokumar.docflow

import android.graphics.Paint
import android.graphics.Typeface
import android.graphics.pdf.PdfDocument
import kotlin.math.max

object PdfWriter {
    fun build(markdown: String): ByteArray {
        val pdf = PdfDocument(); val pageWidth = 595; val pageHeight = 842; val margin = 42
        val paint = Paint(Paint.ANTI_ALIAS_FLAG).apply { color = android.graphics.Color.DKGRAY; textSize = 11f; typeface = Typeface.create("sans", Typeface.NORMAL) }
        val headingPaint = Paint(paint).apply { color = android.graphics.Color.rgb(5,150,105); typeface = Typeface.create("sans", Typeface.BOLD) }
        var pageNo = 1; var page: PdfDocument.Page? = null; var y = margin.toFloat()
        fun startPage() { page = pdf.startPage(PdfDocument.PageInfo.Builder(pageWidth, pageHeight, pageNo++).create()); y = margin.toFloat() }
        fun finishPage() { page?.let { pdf.finishPage(it) }; page = null }
        fun ensure(lineHeight: Float) { if (page == null) startPage(); if (y + lineHeight > pageHeight - margin) { finishPage(); startPage() } }
        fun drawText(text: String, p: Paint = paint, gap: Float = 6f) {
            val maxWidth = pageWidth - 2 * margin; val words = text.split(" "); var line = StringBuilder()
            for (word in words) {
                val candidate = if (line.isEmpty()) word else "$line $word"
                if (p.measureText(candidate) > maxWidth && line.isNotEmpty()) { ensure(18f); page!!.canvas.drawText(line.toString(), margin.toFloat(), y, p); y += 16f; line = StringBuilder(word) }
                else line = StringBuilder(candidate)
            }
            if (line.isNotEmpty()) { ensure(18f); page!!.canvas.drawText(line.toString(), margin.toFloat(), y, p); y += 16f }
            y += gap
        }
        MarkdownEngine.normalize(markdown).lines().forEach { raw ->
            val line = raw.trimEnd()
            when {
                line.startsWith("# ") -> { ensure(28f); y += 5; drawText(line.removePrefix("# "), headingPaint.apply { textSize = 24f }, 10f); headingPaint.textSize = 16f }
                line.startsWith("## ") -> drawText(line.removePrefix("## "), headingPaint.apply { textSize = 18f }, 7f)
                line.startsWith("### ") -> drawText(line.removePrefix("### "), headingPaint.apply { textSize = 14f }, 6f)
                line.isBlank() -> y += 7
                line.startsWith("```") -> drawText("────────────────────────", Paint(paint).apply { color = android.graphics.Color.GRAY }, 2f)
                line.startsWith("- ") -> drawText("• ${line.drop(2)}")
                line.matches(Regex("^\\d+\\.\\s+.*")) -> drawText(line)
                line.startsWith(">") -> drawText("│ ${line.drop(1).trim()}", Paint(paint).apply { color = android.graphics.Color.GRAY })
                else -> drawText(stripMarkdown(line))
            }
        }
        if (page != null) finishPage()
        val out = java.io.ByteArrayOutputStream(); pdf.writeTo(out); pdf.close(); return out.toByteArray()
    }
    private fun stripMarkdown(value: String) = value.replace(Regex("[*_~`]"), "").replace(Regex("!\\[([^]]*)]\\([^)]*\\)"), "$1").replace(Regex("\\[([^]]+)]\\([^)]*\\)"), "$1")
}
