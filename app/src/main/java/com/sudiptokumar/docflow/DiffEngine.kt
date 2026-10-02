package com.sudiptokumar.docflow

object DiffEngine {
    fun diff(old: String, current: String): String {
        val a = old.lines(); val b = current.lines(); val out = StringBuilder()
        val max = maxOf(a.size, b.size)
        for (i in 0 until max) {
            val left = a.getOrNull(i); val right = b.getOrNull(i)
            when {
                left == right -> if (left != null) out.append("  ").append(left).append('\n')
                left == null -> out.append("+ ").append(right).append('\n')
                right == null -> out.append("- ").append(left).append('\n')
                else -> { out.append("- ").append(left).append('\n'); out.append("+ ").append(right).append('\n') }
            }
        }
        return out.toString()
    }
}
