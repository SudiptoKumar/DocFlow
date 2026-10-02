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
