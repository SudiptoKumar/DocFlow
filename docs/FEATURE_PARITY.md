# DocFlow Web → Android feature map

| Original web feature | Android conversion |
|---|---|
| CodeMirror Markdown editor | Compose native text editor |
| Live Markdown preview | Android WebView preview |
| HTML editing mode | HTML content type + preview |
| Find/replace | Native Compose dialog |
| Undo/redo | Android text editing stack |
| localStorage autosave | SharedPreferences autosave |
| Version snapshots + diff | Local snapshot store + line diff |
| Read Aloud | Android TextToSpeech |
| Haptics | Android Vibrator/VibrationEffect |
| Markdown import | Android SAF |
| PDF import | PdfBox-Android |
| Scanned PDF OCR | PdfRenderer + ML Kit |
| DOCX import | DOCX OpenXML parser |
| DOCX export | Minimal Office Open XML writer |
| PDF export | Android PdfDocument |
| HTML / MD / TXT export | Native file output |
| LaTeX | WebView KaTeX rendering |
| Mermaid | WebView Mermaid rendering |
| Function plot fence | Code-preserving fallback |
| Table builder | CSV/tab → Markdown table dialog |
| DuoFlow bilingual mixer | Native Kotlin pairing engine |
| Zen mode | Full-screen Compose surface |
| Mind map view | Heading outline view |
| Supabase PDF function | Not required for first native build |
