plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}

android {
    namespace = "com.inchstone.widget"
    // 35 = Android 15. Still installs & runs on Android 7 (API 24) → Android 16.
    // Don't drop compileSdk below 35 or Android 14/15/16 system widget picker
    // features (previewLayout, targetCell) won't compile.
    compileSdk = 35

    defaultConfig {
        applicationId = "com.inchstone.widget"
        // API 24 (Android 7.0) is the floor: FLAG_IMMUTABLE needs 23+,
        // java.time desugaring needs 24+ for OffsetDateTime. Covers
        // Android 7 → 13 → 14 → 15 → 16 with one APK.
        minSdk = 24
        targetSdk = 35
        versionCode = 1
        versionName = "1.0"
    }

    buildTypes {
        release {
            isMinifyEnabled = false
        }
    }
    compileOptions {
        // java.time (used by fmtTime for Prisma's ISO-8601 strings) needs
        // desugaring to run on API 24/25.
        isCoreLibraryDesugaringEnabled = true
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
    kotlinOptions {
        jvmTarget = "17"
    }
}

dependencies {
    implementation("androidx.core:core-ktx:1.13.1")
    coreLibraryDesugaring("com.android.tools:desugar_jdk_libs:2.0.4")
    // org.json is part of Android itself — no extra deps needed.
}