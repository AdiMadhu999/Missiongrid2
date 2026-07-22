package com.adimadhu.missiongrid;

import android.content.Context;
import android.content.SharedPreferences;
import android.content.pm.PackageInfo;
import android.os.Bundle;
import android.webkit.WebSettings;
import android.webkit.WebView;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        
        // Clear WebView cache if app version changed to ensure fresh assets
        checkAndClearCache();
        
        // Apply early WebView configurations
        optimizeWebView();
    }

    @Override
    public void onStart() {
        super.onStart();
        // Re-verify and apply configurations on start
        optimizeWebView();
    }
    
    private void checkAndClearCache() {
        try {
            SharedPreferences prefs = getSharedPreferences("AppPrefs", Context.MODE_PRIVATE);
            int cachedVersionCode = prefs.getInt("versionCode", -1);
            
            PackageInfo pInfo = getPackageManager().getPackageInfo(getPackageName(), 0);
            int currentVersionCode = pInfo.versionCode;
            
            if (currentVersionCode != cachedVersionCode) {
                WebView webView = this.bridge.getWebView();
                if (webView != null) {
                    webView.clearCache(true);
                    webView.evaluateJavascript("if('serviceWorker' in navigator){navigator.serviceWorker.getRegistrations().then(r=>{for(var i=0;i<r.length;i++)r[i].unregister();});}if('caches' in window){caches.keys().then(n=>{for(var i=0;i<n.length;i++)caches.delete(n[i]);});}", null);
                }
                prefs.edit().putInt("versionCode", currentVersionCode).apply();
            }
        } catch (Exception e) {
            e.printStackTrace();
        }
    }

    private void optimizeWebView() {
        try {
            WebView webView = this.bridge.getWebView();
            if (webView != null) {
                WebSettings settings = webView.getSettings();
                
                // Hardware-accelerated rendering
                webView.setLayerType(android.view.View.LAYER_TYPE_HARDWARE, null);
                
                // Force network load if possible to bypass stale cache
                settings.setCacheMode(WebSettings.LOAD_NO_CACHE);
                
                settings.setDomStorageEnabled(true);
                settings.setDatabaseEnabled(true);
                
                // Content loading performance tuning
                settings.setLoadsImagesAutomatically(true);
                settings.setSaveFormData(false); // Disable form-fill overhead
                
                // Allow secure mixed content for seamless assets loading
                settings.setMixedContentMode(WebSettings.MIXED_CONTENT_ALWAYS_ALLOW);
            }
        } catch (Exception e) {
            // Safe fallback guard to prevent crashes
        }
    }
}
