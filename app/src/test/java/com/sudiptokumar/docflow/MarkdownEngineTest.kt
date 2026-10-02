package com.sudiptokumar.docflow

import org.junit.Assert.assertTrue
import org.junit.Test

class MarkdownEngineTest {
    @Test fun rendersCoreMarkdown() {
        val html = MarkdownEngine.renderMarkdown("# Hello\n\n**bold** and *italic*\n\n- A\n- B")
        assertTrue(html.contains("<h1>"))
        assertTrue(html.contains("<strong>bold</strong>"))
        assertTrue(html.contains("<ul>"))
    }

    @Test fun buildsDuoFlow() {
        val out = DuoFlowEngine.interwoven("One\n\nTwo", "এক\n\nদুই")
        assertTrue(out.contains("One"))
        assertTrue(out.contains("এক"))
        assertTrue(DuoFlowEngine.validate("One\n\nTwo", "এক\n\nদুই").valid)
    }
}
