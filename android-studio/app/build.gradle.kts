plugins {
    id("com.android.application")
}

android {
    namespace = "ma.edu.alwifaq.olympiadclub"
    compileSdk = 36

    defaultConfig {
        applicationId = "ma.edu.alwifaq.olympiadclub"
        minSdk = 26
        targetSdk = 35
        versionCode = 3
        versionName = "1.4.0"
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
}


val webAssetsBesideProject = rootProject.projectDir.parentFile.resolve("www")
val webAssetsInsideProject = rootProject.projectDir.resolve("www")
val webAssetsSource = if (webAssetsBesideProject.isDirectory) webAssetsBesideProject else webAssetsInsideProject

val syncWebAssets by tasks.registering(Copy::class) {
    from(webAssetsSource)
    into(layout.projectDirectory.dir("src/main/assets/www"))
}

tasks.named("preBuild").configure {
    dependsOn(syncWebAssets)
}
