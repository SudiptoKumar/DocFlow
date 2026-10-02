package com.sudiptokumar.docflow

object DuoFlowEngine {
    data class Validation(val valid: Boolean, val message: String)

    private fun blocks(s: String): List<String> = s.trim().split(Regex("\\n\\s*\\n")).filter { it.isNotBlank() }

    fun validate(english: String, bangla: String): Validation {
        val e = blocks(english).size; val b = blocks(bangla).size
        return when {
            e == 0 || b == 0 -> Validation(false, "Both English and Bangla content are required.")
            e != b -> Validation(false, "Block count differs: English $e, Bangla $b. Pair the sections first.")
            else -> Validation(true, "${e} paired blocks ready.")
        }
    }

    fun interwoven(english: String, bangla: String): String {
        val e = blocks(english); val b = blocks(bangla); val n = minOf(e.size, b.size)
        return buildString { for (i in 0 until n) { append(e[i].trim()); append("\n\n"); append(b[i].trim()); if (i < n - 1) append("\n\n") } }
    }

    fun sideBySide(english: String, bangla: String): String {
        val e = blocks(english); val b = blocks(bangla); val n = minOf(e.size, b.size)
        return buildString {
            append("| English | বাংলা |\n|---|---|\n")
            for (i in 0 until n) {
                val left = e[i].replace("|", "\\|").replace("\n", "<br>")
                val right = b[i].replace("|", "\\|").replace("\n", "<br>")
                append("| ").append(left).append(" | ").append(right).append(" |\n")
            }
        }
    }
}
