package com.sudiptokumar.docflow

data class Snapshot(val timestamp: Long, val content: String)

enum class EditorMode { DOCFLOW, DUOFLOW }
enum class ContentType { MARKDOWN, HTML }
enum class PreviewMode { EDITOR, PREVIEW }
enum class DuoPreviewMode { INTERWOVEN, SIDE_BY_SIDE }
