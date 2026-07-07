# Add project specific ProGuard rules here.
# You can control the set of applied configuration files using the
# proguardFiles setting in build.gradle.
#
# For more details, see
#   http://developer.android.com/guide/developing/tools/proguard.html

# Capacitor Proguard Rules
-keep public class * extends com.getcapacitor.Plugin
-keep public class * extends com.getcapacitor.BridgeActivity
-keep class com.getcapacitor.** { *; }

# Keep Cordova plugins and interface classes
-keep class com.apache.cordova.** { *; }
-keep public class * extends org.apache.cordova.CordovaPlugin

# Firebase / Play Services rules (to ensure auth/firestore work flawlessly)
-keep class com.google.firebase.** { *; }
-keep class com.google.android.gms.** { *; }
-keepattributes *Annotation*,Signature,InnerClasses,EnclosingMethod

# Keep Javascript interfaces
-keepattributes JavascriptInterface
-keepclassmembers class * {
    @android.webkit.JavascriptInterface <methods>;
}

# Preserve line numbers and source file names for diagnostics
-keepattributes SourceFile,LineNumberTable

