package com.sudiptokumar.docflow

import android.content.Context
import android.util.Base64
import org.json.JSONArray
import org.json.JSONObject

class Storage(context: Context) {
    private val prefs = context.getSharedPreferences("docflow", Context.MODE_PRIVATE)

    fun loadContent(): String = prefs.getString("autosave", "") ?: ""
    fun saveContent(value: String) { prefs.edit().putString("autosave", value).apply() }
    fun loadContentType(): ContentType = if (prefs.getString("content_type", "markdown") == "html") ContentType.HTML else ContentType.MARKDOWN
    fun saveContentType(type: ContentType) { prefs.edit().putString("content_type", if (type == ContentType.HTML) "html" else "markdown").apply() }

    fun loadDuoEnglish(): String = prefs.getString("duo_en", "") ?: ""
    fun loadDuoBangla(): String = prefs.getString("duo_bn", "") ?: ""
    fun saveDuo(english: String, bangla: String) = prefs.edit().putString("duo_en", english).putString("duo_bn", bangla).apply()

    fun saveSnapshots(snapshots: List<Snapshot>) {
        val array = JSONArray()
        snapshots.take(20).forEach { s ->
            array.put(JSONObject().put("t", s.timestamp).put("c", Base64.encodeToString(s.content.toByteArray(Charsets.UTF_8), Base64.NO_WRAP)))
        }
        prefs.edit().putString("snapshots", array.toString()).apply()
    }

    fun loadSnapshots(): List<Snapshot> = runCatching {
        val array = JSONArray(prefs.getString("snapshots", "[]"))
        buildList {
            for (i in 0 until array.length()) {
                val o = array.getJSONObject(i)
                add(Snapshot(o.getLong("t"), String(Base64.decode(o.getString("c"), Base64.DEFAULT), Charsets.UTF_8)))
            }
        }
    }.getOrDefault(emptyList())
}
