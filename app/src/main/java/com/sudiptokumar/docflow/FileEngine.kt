package com.sudiptokumar.docflow

import android.content.Context
import android.net.Uri
import com.tom_roush.pdfbox.android.PDFBoxResourceLoader
import com.tom_roush.pdfbox.pdmodel.PDDocument
import com.tom_roush.pdfbox.text.PDFTextStripper
import java.io.InputStream
import java.util.zip.ZipEntry
import java.util.zip.ZipInputStream
import org.xmlpull.v1.XmlPullParser
import org.xmlpull.v1.XmlPullParserFactory

object FileEngine {
    fun readText(context: Context, uri: Uri): String = context.contentResolver.openInputStream(uri)?.bufferedReader(Charsets.UTF_8)?.use { it.readText() } ?: ""

    fun readPdf(context: Context, uri: Uri): String {
        PDFBoxResourceLoader.init(context.applicationContext)
        context.contentResolver.openInputStream(uri).use { input ->
            requireNotNull(input) { "Unable to open PDF" }
            PDDocument.load(input).use { doc -> return PDFTextStripper().getText(doc) }
        }
    }

    fun readDocx(context: Context, uri: Uri): String {
        context.contentResolver.openInputStream(uri).use { input ->
            requireNotNull(input) { "Unable to open Word document" }
            return parseDocxDocumentXml(input)
        }
    }

    private fun parseDocxDocumentXml(input: InputStream): String {
        val zis = ZipInputStream(input)
        var foundDocumentXml = false
        while (true) {
            val nextEntry = zis.nextEntry ?: break
            if (nextEntry.name == "word/document.xml") {
                foundDocumentXml = true
                break
            }
        }
        if (!foundDocumentXml) error("Invalid DOCX: word/document.xml not found")
        val parser = XmlPullParserFactory.newInstance().newPullParser().apply { setInput(zis, "UTF-8") }
        val out = StringBuilder(); var event = parser.eventType
        while (event != XmlPullParser.END_DOCUMENT) {
            when (event) {
                XmlPullParser.START_TAG -> if (parser.name == "w:p") {
                    if (out.isNotEmpty()) out.append("\n\n")
                } else if (parser.name == "w:br") out.append('\n')
                XmlPullParser.TEXT -> if (parser.name == null || parser.name == "w:t") out.append(parser.text ?: "")
            }
            event = parser.next()
        }
        return out.toString().trim()
    }

    fun htmlToText(html: String): String = html
        .replace(Regex("<br\\s*/?>", RegexOption.IGNORE_CASE), "\n")
        .replace(Regex("</(p|div|h[1-6]|li|tr)>", RegexOption.IGNORE_CASE), "\n\n")
        .replace(Regex("<[^>]+>"), "")
        .replace("&nbsp;", " ")
        .replace("&amp;", "&")
        .replace("&lt;", "<")
        .replace("&gt;", ">")
        .trim()
}

object DocxWriter {
    fun build(markdown: String, title: String = "DocFlow Document"): ByteArray {
        val document = markdownToDocumentXml(markdown)
        val baos = java.io.ByteArrayOutputStream()
        java.util.zip.ZipOutputStream(baos).use { zip ->
            add(zip, "[Content_Types].xml", contentTypes)
            add(zip, "_rels/.rels", rels)
            add(zip, "word/document.xml", document)
            add(zip, "word/_rels/document.xml.rels", documentRels)
            add(zip, "word/styles.xml", styles)
        }
        return baos.toByteArray()
    }

    private fun markdownToDocumentXml(markdown: String): String {
        val paragraphs = MarkdownEngine.normalize(markdown).lines().filter { it.isNotBlank() }.joinToString("\n") { line ->
            val style = when {
                line.startsWith("###### ") -> "Heading6"
                line.startsWith("##### ") -> "Heading5"
                line.startsWith("#### ") -> "Heading4"
                line.startsWith("### ") -> "Heading3"
                line.startsWith("## ") -> "Heading2"
                line.startsWith("# ") -> "Heading1"
                line.startsWith("- ") -> "ListBullet"
                line.matches(Regex("^\\d+\\.\\s+.*")) -> "ListNumber"
                else -> "Normal"
            }
            val text = line.replaceFirst(Regex("^#{1,6}\\s+"), "").replaceFirst(Regex("^-\\s+"), "• ").replaceFirst(Regex("^\\d+\\.\\s+"), "")
            "<w:p><w:pPr><w:pStyle w:val=\"$style\"/></w:pPr><w:r><w:t xml:space=\"preserve\">${xml(text)}</w:t></w:r></w:p>"
        }
        return "<?xml version=\"1.0\" encoding=\"UTF-8\" standalone=\"yes\"?><w:document xmlns:w=\"http://schemas.openxmlformats.org/wordprocessingml/2006/main\"><w:body>$paragraphs<w:sectPr><w:pgSz w:w=\"11906\" w:h=\"16838\"/><w:pgMar w:top=\"1134\" w:right=\"1134\" w:bottom=\"1134\" w:left=\"1134\"/></w:sectPr></w:body></w:document>"
    }
    private fun add(zip: java.util.zip.ZipOutputStream, name: String, value: String) { zip.putNextEntry(ZipEntry(name)); zip.write(value.toByteArray(Charsets.UTF_8)); zip.closeEntry() }
    private fun xml(value: String) = value.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;").replace("\"", "&quot;")
    private const val contentTypes = """<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/></Types>"""
    private const val rels = """<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>"""
    private const val documentRels = """<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>"""
    private const val styles = """<?xml version="1.0" encoding="UTF-8"?><w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/><w:rPr><w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman"/><w:sz w:val="24"/></w:rPr></w:style><w:style w:type="paragraph" w:styleId="Heading1"><w:name w:val="Heading 1"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:uiPriority w:val="9"/><w:qFormat/><w:rPr><w:b/><w:sz w:val="34"/></w:rPr></w:style><w:style w:type="paragraph" w:styleId="Heading2"><w:name w:val="Heading 2"/><w:basedOn w:val="Normal"/><w:rPr><w:b/><w:sz w:val="30"/></w:rPr></w:style><w:style w:type="paragraph" w:styleId="Heading3"><w:name w:val="Heading 3"/><w:basedOn w:val="Normal"/><w:rPr><w:b/><w:sz w:val="26"/></w:rPr></w:style><w:style w:type="paragraph" w:styleId="Heading4"><w:name w:val="Heading 4"/><w:basedOn w:val="Normal"/></w:style><w:style w:type="paragraph" w:styleId="Heading5"><w:name w:val="Heading 5"/><w:basedOn w:val="Normal"/></w:style><w:style w:type="paragraph" w:styleId="Heading6"><w:name w:val="Heading 6"/><w:basedOn w:val="Normal"/></w:style><w:style w:type="paragraph" w:styleId="ListBullet"><w:name w:val="List Bullet"/><w:basedOn w:val="Normal"/></w:style><w:style w:type="paragraph" w:styleId="ListNumber"><w:name w:val="List Number"/><w:basedOn w:val="Normal"/></w:style></w:styles>"""
}
