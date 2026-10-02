package com.sudiptokumar.docflow

import android.app.Activity
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Bundle
import android.os.VibrationEffect
import android.os.Vibrator
import android.os.VibratorManager
import android.speech.tts.TextToSpeech
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.ArrowBack
import androidx.compose.material.icons.filled.AutoAwesome
import androidx.compose.material.icons.filled.Bolt
import androidx.compose.material.icons.filled.Check
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.ContentCopy
import androidx.compose.material.icons.filled.DarkMode
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material.icons.filled.Description
import androidx.compose.material.icons.filled.Download
import androidx.compose.material.icons.filled.Edit
import androidx.compose.material.icons.filled.FindReplace
import androidx.compose.material.icons.filled.FolderOpen
import androidx.compose.material.icons.filled.History
import androidx.compose.material.icons.filled.LightMode
import androidx.compose.material.icons.filled.Menu
import androidx.compose.material.icons.filled.Mic
import androidx.compose.material.icons.filled.Pause
import androidx.compose.material.icons.filled.PlayArrow
import androidx.compose.material.icons.filled.Print
import androidx.compose.material.icons.filled.Save
import androidx.compose.material.icons.filled.Search
import androidx.compose.material.icons.filled.Settings
import androidx.compose.material.icons.filled.TableChart
import androidx.compose.material.icons.filled.TextFields
import androidx.compose.material.icons.filled.UploadFile
import androidx.compose.material.icons.filled.Visibility
import androidx.compose.material.icons.filled.ZoomOutMap
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.AssistChip
import androidx.compose.material3.BottomAppBar
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.Divider
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FilterChip
import androidx.compose.material3.FloatingActionButton
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.SegmentedButton
import androidx.compose.material3.SegmentedButtonDefaults
import androidx.compose.material3.SingleChoiceSegmentedButtonRow
import androidx.compose.material3.SnackbarHost
import androidx.compose.material3.SnackbarHostState
import androidx.compose.material3.Surface
import androidx.compose.material3.Switch
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateListOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalClipboardManager
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.AnnotatedString
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.viewinterop.AndroidView
import androidx.webkit.WebSettingsCompat
import androidx.webkit.WebViewFeature
import com.sudiptokumar.docflow.ui.theme.DocFlowTheme
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import kotlin.coroutines.resume

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContent { DocFlowRoot() }
    }
}

@Composable
private fun DocFlowRoot() {
    var dark by rememberSaveable { mutableStateOf(false) }
    DocFlowTheme(darkTheme = dark) { DocFlowApp(dark = dark, onDarkChange = { dark = it }) }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun DocFlowApp(dark: Boolean, onDarkChange: (Boolean) -> Unit) {
    val context = LocalContext.current
    val activity = context as Activity
    val storage = remember { Storage(context) }
    var mode by rememberSaveable { mutableStateOf(EditorMode.DOCFLOW) }
    var content by rememberSaveable { mutableStateOf(storage.loadContent()) }
    var contentType by rememberSaveable { mutableStateOf(storage.loadContentType()) }
    var previewMode by rememberSaveable { mutableStateOf(PreviewMode.EDITOR) }
    var searchReplace by remember { mutableStateOf(false) }
    var latexDialog by remember { mutableStateOf(false) }
    var tableDialog by remember { mutableStateOf(false) }
    var historyDialog by remember { mutableStateOf(false) }
    var zen by remember { mutableStateOf(false) }
    var mindMap by remember { mutableStateOf(false) }
    var menu by remember { mutableStateOf(false) }
    var exportMenu by remember { mutableStateOf(false) }
    var isSpeaking by remember { mutableStateOf(false) }
    var tts by remember { mutableStateOf<TextToSpeech?>(null) }
    val snapshots = remember { mutableStateListOf<Snapshot>().apply { addAll(storage.loadSnapshots()) } }
    var stagedPdf by remember { mutableStateOf<Uri?>(null) }
    var stagedOcr by remember { mutableStateOf<Uri?>(null) }
    var processing by remember { mutableStateOf(false) }
    var progressText by remember { mutableStateOf("") }
    val snackbar = remember { SnackbarHostState() }
    val scope = rememberCoroutineScope()
    val clipboard = LocalClipboardManager.current

    val openText = rememberLauncherForActivityResult(ActivityResultContracts.OpenMultipleDocuments()) { uris ->
        if (uris.isNotEmpty()) {
            scope.launch {
                processing = true
                try {
                    val raw = uris.joinToString("\n\n<!-- pagebreak -->\n\n") { uri -> FileEngine.readText(context, uri) }
                    content = MarkdownEngine.format(raw)
                    contentType = ContentType.MARKDOWN
                    snackbar.showSnackbar("File(s) imported")
                } catch (e: Exception) {
                    snackbar.showSnackbar(e.message ?: "Import failed")
                } finally {
                    processing = false
                }
            }
        }
    }
    val openDocx = rememberLauncherForActivityResult(ActivityResultContracts.OpenDocument()) { uri ->
        uri ?: return@rememberLauncherForActivityResult
        scope.launch {
            processing = true
            try {
                content = MarkdownEngine.format(FileEngine.readDocx(context, uri))
                contentType = ContentType.MARKDOWN
                snackbar.showSnackbar("Word document imported")
            } catch (e: Exception) {
                snackbar.showSnackbar(e.message ?: "DOCX import failed")
            } finally {
                processing = false
            }
        }
    }
    val openPdf = rememberLauncherForActivityResult(ActivityResultContracts.OpenDocument()) { uri -> stagedPdf = uri }
    var pendingExportBytes by remember { mutableStateOf<ByteArray?>(null) }
    val saveExport = rememberLauncherForActivityResult(ActivityResultContracts.CreateDocument("application/octet-stream")) { uri ->
        val bytes = pendingExportBytes
        if (uri != null && bytes != null) {
            runCatching { context.contentResolver.openOutputStream(uri)?.use { it.write(bytes) } }
                .onSuccess { scope.launch { snackbar.showSnackbar("Export saved") } }
                .onFailure { scope.launch { snackbar.showSnackbar(it.message ?: "Export failed") } }
        }
        pendingExportBytes = null
    }

    DisposableEffect(Unit) {
        tts = TextToSpeech(context) { }
        onDispose { tts?.stop(); tts?.shutdown() }
    }
    LaunchedEffect(content, contentType) {
        delay(3000)
        if (content.isNotBlank()) { storage.saveContent(content); storage.saveContentType(contentType) }
    }

    fun vibrate(ms: Long = 20) {
        val vibrator = if (android.os.Build.VERSION.SDK_INT >= 31) (context.getSystemService(Context.VIBRATOR_MANAGER_SERVICE) as VibratorManager).defaultVibrator else context.getSystemService(Context.VIBRATOR_SERVICE) as Vibrator
        if (android.os.Build.VERSION.SDK_INT >= 26) vibrator.vibrate(VibrationEffect.createOneShot(ms, VibrationEffect.DEFAULT_AMPLITUDE)) else @Suppress("DEPRECATION") vibrator.vibrate(ms)
    }

    fun snapshot() {
        if (content.isBlank()) return
        snapshots.add(0, Snapshot(System.currentTimeMillis(), content)); while (snapshots.size > 20) snapshots.removeLast(); storage.saveSnapshots(snapshots); vibrate(); scope.launch { snackbar.showSnackbar("Version snapshot saved") }
    }

    fun shareText() {
        val intent = Intent(Intent.ACTION_SEND).apply { type = "text/plain"; putExtra(Intent.EXTRA_TEXT, content) }
        activity.startActivity(Intent.createChooser(intent, "Share DocFlow content"))
    }

    fun export(format: String) {
        if (content.isBlank()) { scope.launch { snackbar.showSnackbar("Add some content first") }; return }
        exportMenu = false
        val name = "DocFlow_${SimpleDateFormat("yyyyMMdd_HHmm", Locale.US).format(Date())}"
        val extension = format
        val bytes = when (format) {
            "pdf" -> PdfWriter.build(content)
            "docx" -> DocxWriter.build(content)
            "html" -> MarkdownEngine.html(content, contentType == ContentType.HTML).toByteArray()
            "md" -> content.toByteArray(Charsets.UTF_8)
            else -> FileEngine.htmlToText(MarkdownEngine.renderMarkdown(content)).toByteArray(Charsets.UTF_8)
        }
        pendingExportBytes = bytes
        saveExport.launch("$name.$extension")
    }

    if (zen) {
        Surface(modifier = Modifier.fillMaxSize(), color = MaterialTheme.colorScheme.background) {
            Column(modifier = Modifier.fillMaxSize().padding(16.dp)) {
                Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.fillMaxWidth()) { IconButton(onClick = { zen = false }) { Icon(Icons.Default.Close, "Exit") }; Text("Zen Mode", style = MaterialTheme.typography.titleLarge); Spacer(Modifier.weight(1f)); IconButton(onClick = { previewMode = if (previewMode == PreviewMode.EDITOR) PreviewMode.PREVIEW else PreviewMode.EDITOR }) { Icon(if (previewMode == PreviewMode.EDITOR) Icons.Default.Visibility else Icons.Default.Edit, "Toggle") } }
                if (previewMode == PreviewMode.EDITOR) EditorPane(content, { content = it }, dark, Modifier.fillMaxSize()) else PreviewPane(content, contentType, Modifier.fillMaxSize())
            }
        }
        return
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Row(verticalAlignment = Alignment.CenterVertically) { Text("Doc", fontWeight = FontWeight.Bold); Text("Flow", color = Color(16,185,129), fontWeight = FontWeight.Bold) } },
                navigationIcon = { IconButton(onClick = { menu = !menu }) { Icon(Icons.Default.Menu, "Menu") } },
                actions = {
                    IconButton(onClick = { onDarkChange(!dark) }) { Icon(if (dark) Icons.Default.LightMode else Icons.Default.DarkMode, "Theme") }
                    IconButton(onClick = { mode = if (mode == EditorMode.DOCFLOW) EditorMode.DUOFLOW else EditorMode.DOCFLOW }) { Icon(Icons.Default.Bolt, "Switch flow") }
                }, colors = TopAppBarDefaults.topAppBarColors(containerColor = MaterialTheme.colorScheme.surface)
            )
        },
        snackbarHost = { SnackbarHost(snackbar) },
        bottomBar = {
            BottomAppBar(modifier = Modifier.navigationBarsPadding()) {
                IconButton(onClick = { openText.launch(arrayOf("text/*", "text/markdown")) }) { Icon(Icons.Default.UploadFile, "Import") }
                IconButton(onClick = { clipboard.getText()?.text?.let { content = if (content.isBlank()) MarkdownEngine.format(it) else content + "\n\n" + MarkdownEngine.format(it) } }) { Icon(Icons.Default.ContentCopy, "Paste") }
                IconButton(onClick = { snapshot() }) { Icon(Icons.Default.Save, "Snapshot") }
                IconButton(onClick = { historyDialog = true }) { Icon(Icons.Default.History, "History") }
                IconButton(onClick = { searchReplace = true }) { Icon(Icons.Default.FindReplace, "Find and replace") }
                IconButton(onClick = { latexDialog = true }) { Icon(Icons.Default.TextFields, "LaTeX") }
                IconButton(onClick = { tableDialog = true }) { Icon(Icons.Default.TableChart, "Table") }
                IconButton(onClick = { zen = true }) { Icon(Icons.Default.ZoomOutMap, "Zen") }
            }
        }
    ) { padding ->
        Column(modifier = Modifier.fillMaxSize().padding(padding)) {
            if (menu) {
                DropdownMenu(expanded = menu, onDismissRequest = { menu = false }) {
                    DropdownMenuItem(text = { Text("DocFlow") }, onClick = { mode = EditorMode.DOCFLOW; menu = false })
                    DropdownMenuItem(text = { Text("DuoFlow") }, onClick = { mode = EditorMode.DUOFLOW; menu = false })
                    DropdownMenuItem(text = { Text("Open DOCX") }, onClick = { openDocx.launch(arrayOf("application/vnd.openxmlformats-officedocument.wordprocessingml.document")); menu = false })
                    DropdownMenuItem(text = { Text("Open PDF") }, onClick = { openPdf.launch(arrayOf("application/pdf")); menu = false })
                    DropdownMenuItem(text = { Text("Clear") }, onClick = { content = ""; mode = EditorMode.DOCFLOW; menu = false })
                }
            }
            if (processing) { LinearProgressIndicator(Modifier.fillMaxWidth()) }
            if (mode == EditorMode.DOCFLOW) {
                HeroCard(content, contentType, dark)
                Spacer(Modifier.height(8.dp))
                SingleChoiceSegmentedButtonRow(Modifier.fillMaxWidth().padding(horizontal = 12.dp)) {
                    SegmentedButton(selected = previewMode == PreviewMode.EDITOR, onClick = { previewMode = PreviewMode.EDITOR }, shape = SegmentedButtonDefaults.itemShape(0, 2)) { Icon(Icons.Default.Edit, null, Modifier.size(16.dp)); Spacer(Modifier.width(6.dp)); Text("Editor") }
                    SegmentedButton(selected = previewMode == PreviewMode.PREVIEW, onClick = { previewMode = PreviewMode.PREVIEW }, shape = SegmentedButtonDefaults.itemShape(1, 2)) { Icon(Icons.Default.Visibility, null, Modifier.size(16.dp)); Spacer(Modifier.width(6.dp)); Text("Preview") }
                }
                Spacer(Modifier.height(8.dp))
                Box(Modifier.weight(1f).fillMaxWidth().padding(horizontal = 12.dp)) {
                    if (previewMode == PreviewMode.EDITOR) EditorPane(content, { content = it }, dark, Modifier.fillMaxSize()) else PreviewPane(content, contentType, Modifier.fillMaxSize())
                }
                Row(Modifier.fillMaxWidth().padding(12.dp), horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.CenterVertically) {
                    Button(onClick = { exportMenu = !exportMenu }, enabled = content.isNotBlank()) { Icon(Icons.Default.Download, null); Spacer(Modifier.width(6.dp)); Text("Export") }
                    DropdownMenu(expanded = exportMenu, onDismissRequest = { exportMenu = false }) {
                        listOf("docx" to "Word", "pdf" to "PDF", "html" to "HTML", "md" to "Markdown", "txt" to "Plain text").forEach { (f, label) -> DropdownMenuItem(text = { Text("$label  .$f") }, onClick = { export(f) }) }
                    }
                    OutlinedButton(onClick = { clipboard.setText(AnnotatedString(FileEngine.htmlToText(MarkdownEngine.renderMarkdown(content)))); scope.launch { snackbar.showSnackbar("Copied as plain text") } }, enabled = content.isNotBlank()) { Icon(Icons.Default.ContentCopy, null); Spacer(Modifier.width(6.dp)); Text("Copy") }
                    IconButton(onClick = {
                        val text = FileEngine.htmlToText(MarkdownEngine.renderMarkdown(content))
                        if (!isSpeaking) { tts?.speak(text, TextToSpeech.QUEUE_FLUSH, null, "docflow"); isSpeaking = true } else { tts?.stop(); isSpeaking = false }
                    }, enabled = content.isNotBlank()) { Icon(if (isSpeaking) Icons.Default.Pause else Icons.Default.PlayArrow, "Read aloud") }
                    IconButton(onClick = { mindMap = true }, enabled = content.isNotBlank()) { Icon(Icons.Default.AutoAwesome, "Outline") }
                }
                Spacer(Modifier.height(6.dp))
            } else {
                DuoFlowScreen(storage, { snackbarHostMessage -> scope.launch { snackbar.showSnackbar(snackbarHostMessage) } })
            }
        }
    }

    if (stagedPdf != null) {
        AlertDialog(onDismissRequest = { stagedPdf = null }, title = { Text("PDF Import") }, text = { Text("Choose text extraction or scan the PDF with OCR." ) }, confirmButton = { TextButton(onClick = { val uri = stagedPdf; stagedPdf = null; scope.launch { processing = true; try { content = MarkdownEngine.format(FileEngine.readPdf(context, uri!!)); contentType = ContentType.MARKDOWN; snackbar.showSnackbar("PDF extracted") } catch (e: Exception) { snackbar.showSnackbar(e.message ?: "PDF extraction failed") } finally { processing = false } } }) { Text("Extract text") } }, dismissButton = { TextButton(onClick = { stagedOcr = stagedPdf; stagedPdf = null }) { Text("Use OCR") } })
    }
    if (stagedOcr != null) {
        AlertDialog(onDismissRequest = { stagedOcr = null }, title = { Text("OCR") }, text = { Text("Native OCR uses ML Kit and works best with clear scanned pages. The PDF is rendered page-by-page and recognized locally.") }, confirmButton = { TextButton(onClick = { val uri = stagedOcr; stagedOcr = null; scope.launch { processing = true; progressText = "Running OCR…"; try { content = MarkdownEngine.format(PdfOcr.extract(context, uri!!) { progressText = it }); contentType = ContentType.MARKDOWN; snackbar.showSnackbar("OCR completed") } catch (e: Exception) { snackbar.showSnackbar(e.message ?: "OCR failed") } finally { progressText = ""; processing = false } } }) { Text("Start OCR") } }, dismissButton = { TextButton(onClick = { stagedOcr = null }) { Text("Cancel") } })
    }
    if (searchReplace) FindReplaceDialog(content, { content = it }, { searchReplace = false })
    if (latexDialog) InsertTextDialog("Insert LaTeX", "e.g. \$E=mc^2\$ or \$\$\\frac{a}{b}\$\$", { latex -> content += latex; latexDialog = false }, { latexDialog = false })
    if (tableDialog) InsertTableDialog({ table -> content += if (content.isBlank()) table else "\n\n$table"; tableDialog = false }, { tableDialog = false })
    if (historyDialog) HistoryDialog(snapshots, content, { selected -> content = selected }, { historyDialog = false })
    if (mindMap) OutlineDialog(content) { mindMap = false }
}

@Composable
private fun HeroCard(content: String, type: ContentType, dark: Boolean) {
    Card(modifier = Modifier.fillMaxWidth().padding(12.dp), colors = CardDefaults.cardColors(containerColor = if (dark) Color(0xFF052E2B) else Color(0xFFECFDF5))) {
        Row(Modifier.padding(16.dp), verticalAlignment = Alignment.CenterVertically) {
            Column(Modifier.weight(1f)) { Text("Study Tool", fontSize = 12.sp, color = Color(5,150,105)); Text("DocFlow", style = MaterialTheme.typography.headlineSmall, fontWeight = FontWeight.Bold); Text(if (content.isBlank()) "Write, format, convert" else "${content.lines().size} lines • ${content.length} chars", color = MaterialTheme.colorScheme.onSurfaceVariant) }
            AssistChip(onClick = {}, label = { Text(if (type == ContentType.HTML) "HTML" else "Markdown") }, leadingIcon = { Icon(Icons.Default.Description, null, Modifier.size(16.dp)) })
        }
    }
}

@Composable
private fun EditorPane(content: String, onChange: (String) -> Unit, dark: Boolean, modifier: Modifier) {
    Card(modifier = modifier, colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface)) {
        BasicTextField(
            value = content,
            onValueChange = onChange,
            modifier = Modifier.fillMaxSize().padding(14.dp).verticalScroll(rememberScrollState()),
            textStyle = TextStyle(fontFamily = FontFamily.Monospace, fontSize = 15.sp, color = MaterialTheme.colorScheme.onSurface),
            decorationBox = { inner -> if (content.isEmpty()) Text("Start writing Markdown…", color = MaterialTheme.colorScheme.onSurfaceVariant); inner() }
        )
    }
}

@Composable
private fun PreviewPane(content: String, type: ContentType, modifier: Modifier) {
    Card(modifier = modifier, colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface)) {
        AndroidView(
            modifier = Modifier.fillMaxSize(),
            factory = { ctx -> WebView(ctx).apply { webViewClient = WebViewClient(); settings.javaScriptEnabled = true; settings.domStorageEnabled = true; loadDataWithBaseURL(null, MarkdownEngine.html(content, type == ContentType.HTML), "text/html", "UTF-8", null) } },
            update = { it.loadDataWithBaseURL(null, MarkdownEngine.html(content, type == ContentType.HTML), "text/html", "UTF-8", null) }
        )
    }
}

@Composable
private fun DuoFlowScreen(storage: Storage, notify: (String) -> Unit) {
    var english by rememberSaveable { mutableStateOf(storage.loadDuoEnglish()) }
    var bangla by rememberSaveable { mutableStateOf(storage.loadDuoBangla()) }
    var mode by rememberSaveable { mutableStateOf(DuoPreviewMode.INTERWOVEN) }
    var result by remember { mutableStateOf("") }
    var valid by remember { mutableStateOf<DuoFlowEngine.Validation?>(null) }
    LaunchedEffect(english, bangla) { storage.saveDuo(english, bangla); valid = DuoFlowEngine.validate(english, bangla); result = if (mode == DuoPreviewMode.INTERWOVEN) DuoFlowEngine.interwoven(english, bangla) else DuoFlowEngine.sideBySide(english, bangla) }
    Column(Modifier.fillMaxSize().padding(12.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
        Card(colors = CardDefaults.cardColors(containerColor = Color(0xFFF5F3FF))) { Column(Modifier.padding(14.dp)) { Text("DuoFlow", style = MaterialTheme.typography.headlineSmall, fontWeight = FontWeight.Bold); Text("Pair English and Bangla blocks, then create an interwoven or side-by-side document.", color = MaterialTheme.colorScheme.onSurfaceVariant) } }
        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            OutlinedTextField(english, { english = it }, Modifier.weight(1f).height(180.dp), label = { Text("English") })
            OutlinedTextField(bangla, { bangla = it }, Modifier.weight(1f).height(180.dp), label = { Text("বাংলা") })
        }
        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
            if (valid != null) Text(valid!!.message, color = if (valid!!.valid) Color(5,150,105) else MaterialTheme.colorScheme.error, fontSize = 12.sp)
            SingleChoiceSegmentedButtonRow {
                SegmentedButton(selected = mode == DuoPreviewMode.INTERWOVEN, onClick = { mode = DuoPreviewMode.INTERWOVEN }, shape = SegmentedButtonDefaults.itemShape(0, 2)) { Text("Interwoven") }
                SegmentedButton(selected = mode == DuoPreviewMode.SIDE_BY_SIDE, onClick = { mode = DuoPreviewMode.SIDE_BY_SIDE }, shape = SegmentedButtonDefaults.itemShape(1, 2)) { Text("Side-by-side") }
            }
        }
        Button(onClick = { if (valid?.valid == true) notify("DuoFlow document generated") else notify(valid?.message ?: "Add both files") }, enabled = valid?.valid == true) { Icon(Icons.Default.Check, null); Spacer(Modifier.width(6.dp)); Text("Mix Files") }
        PreviewPane(result, ContentType.MARKDOWN, Modifier.weight(1f).fillMaxWidth())
    }
}

@Composable
private fun FindReplaceDialog(content: String, onChange: (String) -> Unit, close: () -> Unit) {
    var find by remember { mutableStateOf("") }; var replace by remember { mutableStateOf("") }
    AlertDialog(onDismissRequest = close, title = { Text("Find & Replace") }, text = { Column(verticalArrangement = Arrangement.spacedBy(8.dp)) { OutlinedTextField(value = find, onValueChange = { find = it }, label = { Text("Find") }); OutlinedTextField(value = replace, onValueChange = { replace = it }, label = { Text("Replace") }) } }, confirmButton = { TextButton(onClick = { if (find.isNotEmpty()) onChange(content.replace(find, replace)); close() }) { Text("Replace all") } }, dismissButton = { TextButton(onClick = close) { Text("Cancel") } })
}

@Composable
private fun InsertTextDialog(title: String, hint: String, submit: (String) -> Unit, close: () -> Unit) {
    var text by remember { mutableStateOf("") }
    AlertDialog(onDismissRequest = close, title = { Text(title) }, text = { OutlinedTextField(value = text, onValueChange = { text = it }, label = { Text(hint) }, minLines = 4) }, confirmButton = { TextButton(onClick = { submit(text) }) { Text("Insert") } }, dismissButton = { TextButton(onClick = close) { Text("Cancel") } })
}

@Composable
private fun InsertTableDialog(submit: (String) -> Unit, close: () -> Unit) {
    var csv by remember { mutableStateOf("Name,Value\nA,1\nB,2") }
    AlertDialog(onDismissRequest = close, title = { Text("Table Builder") }, text = { OutlinedTextField(value = csv, onValueChange = { csv = it }, minLines = 5, label = { Text("CSV / tab-separated data") }) }, confirmButton = { TextButton(onClick = { submit(buildTable(csv)); }) { Text("Insert") } }, dismissButton = { TextButton(onClick = close) { Text("Cancel") } })
}

private fun buildTable(input: String): String {
    val rows = input.lines().filter { it.isNotBlank() }.map { it.split(Regex(",|\\t|\\|")) }
    if (rows.isEmpty()) return ""
    val cols = rows.maxOf { it.size }
    val norm = rows.map { (it + List(cols - it.size) { "" }).take(cols) }
    return buildString { append("| "); append(norm.first().joinToString(" | ")); append(" |\n| "); append(List(cols) { "---" }.joinToString(" | ")); append(" |\n"); norm.drop(1).forEach { append("| ").append(it.joinToString(" | ")).append(" |\n") } }
}

@Composable
private fun HistoryDialog(snapshots: List<Snapshot>, current: String, restore: (String) -> Unit, close: () -> Unit) {
    var selected by remember { mutableStateOf<Snapshot?>(null) }
    if (selected == null) {
        AlertDialog(onDismissRequest = close, title = { Text("Version snapshots") }, text = { LazyColumn { itemsIndexed(snapshots) { idx, s -> Card(Modifier.fillMaxWidth().padding(vertical = 4.dp).clickable { selected = s }) { Column(Modifier.padding(10.dp)) { Text("Snapshot ${idx+1}", fontWeight = FontWeight.Bold); Text(SimpleDateFormat("yyyy-MM-dd HH:mm:ss", Locale.US).format(Date(s.timestamp)), fontSize = 12.sp); Text("${s.content.length} characters", fontSize = 12.sp) } } } } }, confirmButton = { TextButton(onClick = close) { Text("Close") } })
    } else {
        AlertDialog(onDismissRequest = { selected = null }, title = { Text("Diff") }, text = { Box(Modifier.height(380.dp).verticalScroll(rememberScrollState())) { Text(DiffEngine.diff(selected!!.content, current), fontFamily = FontFamily.Monospace, fontSize = 12.sp) } }, confirmButton = { TextButton(onClick = { restore(selected!!.content); close() }) { Text("Restore") } }, dismissButton = { TextButton(onClick = { selected = null }) { Text("Back") } })
    }
}

@Composable
private fun OutlineDialog(content: String, close: () -> Unit) {
    val headings = content.lines().filter { it.matches(Regex("^#{1,6}\\s+.*")) }
    AlertDialog(onDismissRequest = close, title = { Text("Document outline") }, text = { LazyColumn { itemsIndexed(headings) { _, h -> Text(h, modifier = Modifier.padding(vertical = 4.dp), fontWeight = if (h.startsWith("# ")) FontWeight.Bold else FontWeight.Normal) } } }, confirmButton = { TextButton(onClick = close) { Text("Close") } })
}

private object PdfOcr {
    suspend fun extract(context: Context, uri: Uri, progress: (String) -> Unit): String = kotlinx.coroutines.suspendCancellableCoroutine { cont ->
        try {
            val pfd = context.contentResolver.openFileDescriptor(uri, "r") ?: error("Unable to open PDF")
            val renderer = android.graphics.pdf.PdfRenderer(pfd)
            val recognizer = com.google.mlkit.vision.text.TextRecognition.getClient(com.google.mlkit.vision.text.latin.TextRecognizerOptions.DEFAULT_OPTIONS)
            val sb = StringBuilder()
            fun page(index: Int) {
                if (index >= renderer.pageCount) { renderer.close(); pfd.close(); recognizer.close(); if (cont.isActive) cont.resume(sb.toString()); return }
                progress("OCR page ${index + 1}/${renderer.pageCount}")
                val pg = renderer.openPage(index)
                val width = (pg.width * 1.8f).toInt(); val height = (pg.height * 1.8f).toInt(); val bmp = android.graphics.Bitmap.createBitmap(width, height, android.graphics.Bitmap.Config.ARGB_8888)
                pg.render(bmp, null, null, android.graphics.pdf.PdfRenderer.Page.RENDER_MODE_FOR_DISPLAY); pg.close()
                val image = com.google.mlkit.vision.common.InputImage.fromBitmap(bmp, 0)
                recognizer.process(image).addOnSuccessListener { result -> sb.append(result.text).append("\n\n"); bmp.recycle(); page(index + 1) }.addOnFailureListener { e -> bmp.recycle(); renderer.close(); pfd.close(); recognizer.close(); if (cont.isActive) cont.resumeWith(Result.failure(e)) }
            }
            page(0)
            cont.invokeOnCancellation { runCatching { renderer.close() }; runCatching { pfd.close() }; runCatching { recognizer.close() } }
        } catch (e: Exception) { cont.resumeWith(Result.failure(e)) }
    }
}
