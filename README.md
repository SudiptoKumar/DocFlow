# DocFlow Android

Native Android/Kotlin + Jetpack Compose conversion of the supplied DocFlow web app.

The project uses Android Gradle Plugin 9.4 with AGP's built-in Kotlin support. The separate `org.jetbrains.kotlin.android` plugin is intentionally not applied because AGP 9+ provides Kotlin natively.

## What is included

- Native Kotlin + Jetpack Compose UI
- Markdown editor with autosave
- Rich Markdown preview in an Android WebView
- HTML input/preview mode support
- Markdown normalization/formatter
- PDF text extraction using PdfBox-Android
- Scanned PDF OCR using ML Kit + Android PdfRenderer
- DOCX import using the OpenXML document XML
- DOCX export
- PDF export
- HTML / Markdown / plain-text export
- Copy content
- Android Text-to-Speech read aloud
- Haptic feedback
- Version snapshots and line-based diff/restore
- Find & replace
- LaTeX insertion
- Markdown table builder
- Zen mode
- Document outline / mind-map style heading view
- DuoFlow English + Bangla mixing, validation, interwoven and side-by-side modes
- GitHub Actions APK build

## Native parity notes

Some browser-only internals from the original app were replaced with native equivalents. The editor is native Compose instead of CodeMirror. Mermaid/KaTeX rendering is handled by the preview WebView so the rich preview can remain close to the original. Function-plot fences are preserved as code with a clear fallback message in the Android build.

The first version intentionally keeps the document engine local. No Supabase dependency is required for core editing, import, preview, OCR or export.

## Build locally

Use Android Studio with JDK 17 and an Android SDK that supports API 37.

From the project root:

```bash
gradle :app:assembleDebug
```

The generated APK is:

```text
app/build/outputs/apk/debug/app-debug.apk
```

## GitHub Actions

The repository contains `.github/workflows/build-apk.yml`.

Every push/PR builds the debug APK, runs the unit tests, and uploads the APK as a workflow artifact. A tag such as `v1.0.0` also creates a GitHub Release and attaches the debug APK. The workflow uses current Node 24-compatible GitHub Actions versions.

A production-signed release can be added later with `DOCFLOW_KEYSTORE_BASE64`, `DOCFLOW_KEYSTORE_PASSWORD`, and `DOCFLOW_KEY_ALIAS` GitHub secrets without changing the app source.

## Repository structure

```text
DocFlow/
├── app/
│   ├── src/main/java/com/sudiptokumar/docflow/
│   │   ├── MainActivity.kt
│   │   ├── MarkdownEngine.kt
│   │   ├── FileEngine.kt
│   │   ├── DocFlowModels.kt
│   │   ├── DuoFlowEngine.kt
│   │   ├── DiffEngine.kt
│   │   ├── Storage.kt
│   │   ├── PdfWriter.kt
│   │   └── ui/theme/Theme.kt
│   └── src/main/res/
├── .github/workflows/build-apk.yml
├── build.gradle.kts
├── settings.gradle.kts
└── README.md
```

## Build-fix notes

The supplied CI log failed before compilation because AGP 9.4 already provides built-in Kotlin, while the module also applied `org.jetbrains.kotlin.android`. That duplicate Kotlin extension caused `Cannot add extension with name 'kotlin'`. The project is now migrated to AGP 9+ built-in Kotlin and keeps only the Compose compiler plugin.

The Markdown engine also avoids Android framework-only helpers so its JVM unit tests can execute on GitHub Actions without Android “method not mocked” failures.


## Build 1.0.5
Fixed the Compose `Modifier.clip()` import used by the restored design UI.
