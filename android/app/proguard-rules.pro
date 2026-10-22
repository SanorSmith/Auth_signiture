# kotlinx.serialization keeps the generated serializers; OkHttp and Okio ship their own rules.
-keepattributes *Annotation*, InnerClasses
-dontnote kotlinx.serialization.**
-keepclassmembers class kotlinx.serialization.json.** { *** Companion; }
-keepclasseswithmembers class kotlinx.serialization.json.** { kotlinx.serialization.KSerializer serializer(...); }
-keep,includedescriptorclasses class com.authsignature.app.**$$serializer { *; }
-keepclassmembers class com.authsignature.app.** { *** Companion; }
-keepclasseswithmembers class com.authsignature.app.** { kotlinx.serialization.KSerializer serializer(...); }
# Please add these rules to your existing keep rules in order to suppress warnings.
# This is generated automatically by the Android Gradle plugin.
-dontwarn com.google.errorprone.annotations.CanIgnoreReturnValue
-dontwarn com.google.errorprone.annotations.CheckReturnValue
-dontwarn com.google.errorprone.annotations.Immutable
-dontwarn com.google.errorprone.annotations.RestrictedApi