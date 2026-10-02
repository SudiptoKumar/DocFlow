package com.sudiptokumar.docflow

import android.text.TextUtils

object MarkdownEngine {
    fun normalize(input: String): String {
        var s = input.replace("\r\n", "\n").replace('\r', '\n')
        s = s.lines().joinToString("\n") { it.trimEnd() }
        s = s.replace(Regex("\\n{3,}"), "\n\n")
        return s.trim()
    }

    fun format(input: String): String {
        var s = normalize(input)
        if (s.isBlank()) return ""
        val lines = s.lines().toMutableList()
        val out = mutableListOf<String>()
        var inCode = false
        var codeLang = ""
        for (line in lines) {
            if (line.trimStart().startsWith("```")) {
                if (!inCode) {
                    inCode = true
                    codeLang = line.trim().removePrefix("```").trim()
                    out += "```$codeLang"
                } else {
                    inCode = false
                    out += "```"
                }
                continue
            }
            if (inCode) { out += line; continue }
            val cleaned = line
                .replace(Regex("^\\s*[-*+]\\s+"), "- ")
                .replace(Regex("^\\s*(\\d+)[.)]\\s+"), "$1. ")
            out += cleaned
        }
        return normalize(out.joinToString("\n"))
    }

    fun html(markdown: String, sourceHtml: Boolean = false): String {
        return if (sourceHtml) fullHtml(markdown) else fullHtml(renderMarkdown(markdown))
    }

    private fun fullHtml(body: String): String = """
        <!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1">
        <style>
        :root{color-scheme:light dark}body{font-family:system-ui,-apple-system,sans-serif;line-height:1.68;padding:22px;max-width:900px;margin:auto;color:#1f2937;background:#fff}
        h1,h2,h3,h4,h5,h6{line-height:1.25;margin-top:1.2em}h1{color:#059669}h2{color:#0f766e}a{color:#2563eb}pre{background:#0f172a;color:#e2e8f0;padding:14px;border-radius:10px;overflow:auto}code{background:#f1f5f9;padding:2px 5px;border-radius:5px}pre code{background:none;padding:0}
        blockquote{border-left:4px solid #10b981;padding-left:14px;color:#64748b}table{width:100%;border-collapse:collapse;margin:1em 0}th,td{border:1px solid #cbd5e1;padding:7px;text-align:left}th{background:#ecfdf5}img{max-width:100%}.admonition{padding:12px 14px;border-radius:10px;background:#f0fdf4;border:1px solid #bbf7d0}.math{font-family:serif}.mermaid{overflow:auto}
        @media(prefers-color-scheme:dark){body{background:#0f172a;color:#e2e8f0}code{background:#1e293b}th{background:#064e3b}th,td{border-color:#334155}blockquote{color:#94a3b8}}
        </style>
        <script src="https://cdn.jsdelivr.net/npm/katex@0.16.28/dist/katex.min.js"></script>
        <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.28/dist/katex.min.css">
        <script src="https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.min.js"></script>
        </head><body>$body<script>try{mermaid.initialize({startOnLoad:true,theme:'default'});document.querySelectorAll('.math-inline').forEach(e=>{try{katex.render(e.dataset.math,e,{throwOnError:false,displayMode:false})}catch(_){} });document.querySelectorAll('.math-block').forEach(e=>{try{katex.render(e.dataset.math,e,{throwOnError:false,displayMode:true})}catch(_){} });}catch(_){}</script></body></html>
    """.trimIndent()

    fun renderMarkdown(markdown: String): String {
        val normalized = normalize(markdown)
        if (normalized.isBlank()) return "<p style='color:#94a3b8'>Start writing…</p>"
        val lines = normalized.lines()
        val out = StringBuilder()
        var i = 0
        var inCode = false
        var codeLang = ""
        val code = StringBuilder()

        fun closeList() { }
        while (i < lines.size) {
            val line = lines[i]
            if (line.trimStart().startsWith("```") || line.trimStart().startsWith("~~~")) {
                if (!inCode) {
                    inCode = true; code.clear(); codeLang = line.trim().drop(3).trim()
                } else {
                    inCode = false
                    if (codeLang.equals("mermaid", true)) {
                        out.append("<div class='mermaid'>${escape(code.toString())}</div>")
                    } else if (codeLang.equals("plot", true)) {
                        out.append("<pre><code>${escape(code.toString())}</code></pre><p><em>Function plot blocks are preserved as code in the native preview.</em></p>")
                    } else {
                        out.append("<pre><code>${escape(code.toString())}</code></pre>")
                    }
                }
                i++; continue
            }
            if (inCode) { code.append(line).append('\n'); i++; continue }

            when {
                line.isBlank() -> { i++; continue }
                line.matches(Regex("^#{1,6}\\s+.*")) -> {
                    val m = Regex("^(#{1,6})\\s+(.*)$").find(line)!!
                    val level = m.groupValues[1].length
                    out.append("<h$level>${inline(m.groupValues[2])}</h$level>")
                }
                line.matches(Regex("^[-*_]{3,}\\s*$")) -> out.append("<hr>")
                line.startsWith(">") -> out.append("<blockquote>${inline(line.removePrefix("> ").removePrefix(">"))}</blockquote>")
                line.startsWith("- ") || line.startsWith("* ") || line.startsWith("+ ") -> {
                    out.append("<ul>")
                    while (i < lines.size && (lines[i].startsWith("- ") || lines[i].startsWith("* ") || lines[i].startsWith("+ "))) {
                        val item = lines[i].drop(2)
                        val checked = item.matches(Regex("\\[[ xX]\\]\\s+.*"))
                        val text = if (checked) item.drop(4) else item
                        val box = if (checked) "<input type='checkbox' disabled ${if(item[1].equals('x', true)) "checked" else ""}> " else ""
                        out.append("<li>$box${inline(text)}</li>"); i++
                    }
                    out.append("</ul>")
                    continue
                }
                line.matches(Regex("^\\d+\\.\\s+.*")) -> {
                    out.append("<ol>")
                    while (i < lines.size && lines[i].matches(Regex("^\\d+\\.\\s+.*"))) {
                        out.append("<li>${inline(lines[i].replaceFirst(Regex("^\\d+\\.\\s+"), ""))}</li>"); i++
                    }
                    out.append("</ol>"); continue
                }
                line.startsWith("|") && line.endsWith("|") && i + 1 < lines.size && lines[i+1].contains("---") -> {
                    val header = parseTableRow(line); i += 2; val rows = mutableListOf<List<String>>()
                    while (i < lines.size && lines[i].startsWith("|")) { rows += parseTableRow(lines[i]); i++ }
                    out.append("<table><thead><tr>${header.joinToString(""){ "<th>${inline(it)}</th>" }}</tr></thead><tbody>")
                    rows.forEach { r -> out.append("<tr>${r.joinToString(""){ "<td>${inline(it)}</td>" }}</tr>") }
                    out.append("</tbody></table>"); continue
                }
                line.startsWith("<") && line.endsWith(">") -> out.append(line)
                else -> {
                    val para = buildString {
                        append(line); var j = i + 1
                        while (j < lines.size && lines[j].isNotBlank() && !lines[j].startsWith("#") && !lines[j].startsWith("- ") && !lines[j].startsWith("* ") && !lines[j].startsWith(">") && !lines[j].startsWith("|") && !lines[j].startsWith("```") && !lines[j].matches(Regex("^\\d+\\.\\s+.*"))) { append(" ").append(lines[j]); j++ }
                        i = j - 1
                    }
                    out.append("<p>${inline(para)}</p>")
                }
            }
            i++
        }
        return out.toString()
    }

    private fun parseTableRow(row: String): List<String> = row.trim().removePrefix("|").removeSuffix("|").split("|").map { it.trim() }

    private fun inline(text: String): String {
        var s = escape(text)
        val mathBlocks = mutableListOf<String>()
        s = s.replace(Regex("\\$\\$([\\s\\S]+?)\\$\\$")) { m -> val idx = mathBlocks.size; mathBlocks += m.groupValues[1]; "§§MATHBLOCK$idx§§" }
        s = s.replace(Regex("(?<!\\$)\\$([^$\\n]+)\\$") ) { m -> val idx = mathBlocks.size; mathBlocks += m.groupValues[1]; "§§MATHINLINE$idx§§" }
        s = s.replace(Regex("!\\[([^]]*)]\\(([^ )]+)(?:\\s+\\\"[^\"]*\\\")?\\)"), "<img alt=\"$1\" src=\"$2\">")
        s = s.replace(Regex("\\[([^]]+)]\\(([^)]+)\\)"), "<a href=\"$2\">$1</a>")
        s = s.replace(Regex("`([^`]+)`"), "<code>$1</code>")
        s = s.replace(Regex("\\*\\*([^*]+)\\*\\*|__([^_]+)__")) { m -> "<strong>${m.groupValues[1].ifBlank { m.groupValues[2] }}</strong>" }
        s = s.replace(Regex("(?<!\\*)\\*([^*]+)\\*(?!\\*)|(?<!_)_([^_]+)_(?!_)")) { m -> "<em>${m.groupValues[1].ifBlank { m.groupValues[2] }}</em>" }
        s = s.replace(Regex("~~([^~]+)~~"), "<del>$1</del>")
        mathBlocks.forEachIndexed { index, value ->
            val marker1 = "§§MATHBLOCK$index§§"; val marker2 = "§§MATHINLINE$index§§"
            s = s.replace(marker1, "<div class='math-block' data-math=\"${escapeAttr(value)}\"></div>")
            s = s.replace(marker2, "<span class='math-inline' data-math=\"${escapeAttr(value)}\"></span>")
        }
        return s.replace("  ", "<br>")
    }

    private fun escape(s: String): String = TextUtils.htmlEncode(s)
    private fun escapeAttr(s: String): String = escape(s).replace("\"", "&quot;")
}
