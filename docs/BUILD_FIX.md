# DocFlow Android Build Fix

## CI failure diagnosed

The uploaded GitHub Actions log failed during Gradle configuration at `app/build.gradle.kts:1` with:

```text
Failed to apply plugin 'org.jetbrains.kotlin.android'.
Cannot add extension with name 'kotlin', as there is an extension already registered with that name.
```

AGP 9+ provides built-in Kotlin support, so the separate `org.jetbrains.kotlin.android` plugin must not be applied. The module was migrated accordingly.

## Additional test-stage hardening

`MarkdownEngine` previously depended on `android.text.TextUtils.htmlEncode`. The Markdown unit tests run on the JVM and therefore should not require a mocked Android framework method. HTML escaping is now implemented locally in pure Kotlin.

## CI maintenance

GitHub Actions was updated to current Node 24-compatible major versions for checkout, Java setup, Gradle setup, and release publishing.

## CI fix from 2026-10-02 run

The second GitHub Actions run reached Kotlin compilation and reported three source errors:

- `FileEngine.kt:39`: nullable `ZipEntry` usage could leave `entry` uninitialized under the current Kotlin compiler. The DOCX scan now uses a non-null `nextEntry` local plus an explicit `foundDocumentXml` flag.
- `MainActivity.kt:132`: `setContent` was unresolved because `androidx.activity.compose.setContent` was not imported. The import is now present.
- `MainActivity.kt:338`: the LaTeX help string contained an unescaped `$E`, which Kotlin interpreted as string interpolation. The dollar signs are now escaped and `\\frac` is preserved as a literal LaTeX command.

The workflow configuration itself is reaching compilation successfully. After these source fixes, the same `:app:assembleDebug :app:testDebugUnitTest` tasks should progress past the reported compilation blockers.
