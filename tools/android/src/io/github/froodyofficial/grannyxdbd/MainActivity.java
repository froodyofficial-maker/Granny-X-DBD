package io.github.froodyofficial.grannyxdbd;

import android.app.Activity;
import android.content.Intent;
import android.net.Uri;
import java.io.BufferedReader;
import java.io.InputStream;
import java.io.InputStreamReader;
import org.json.JSONObject;
import android.os.Bundle;
import android.view.View;
import android.view.WindowManager;
import android.webkit.WebChromeClient;
import android.webkit.WebSettings;
import android.webkit.WebView;

// Granny x DBD for Android: the game runs offline from the app's assets, fullscreen and landscape.
public class MainActivity extends Activity {
  private WebView web;

  @Override protected void onCreate(Bundle saved) {
    super.onCreate(saved);
    getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON | WindowManager.LayoutParams.FLAG_FULLSCREEN);
    web = new WebView(this);
    WebSettings s = web.getSettings();
    s.setJavaScriptEnabled(true);
    s.setDomStorageEnabled(true);
    s.setDatabaseEnabled(true);
    s.setAllowFileAccess(true);
    s.setAllowFileAccessFromFileURLs(true);
    s.setAllowUniversalAccessFromFileURLs(true);
    s.setMediaPlaybackRequiresUserGesture(false);
    s.setUseWideViewPort(true);
    s.setLoadWithOverviewMode(true);
    s.setSupportZoom(false);
    s.setBuiltInZoomControls(false);
    s.setDisplayZoomControls(false);
    web.setWebChromeClient(new WebChromeClient());
    web.addJavascriptInterface(new GameStore(this), "GameStore"); // a copy of the saves in the app's storage
    web.setWebViewClient(new GameClient(this));
    setContentView(web);
    immersive();
    web.loadUrl("file:///android_asset/index.html");
  }

  private void immersive() {
    getWindow().getDecorView().setSystemUiVisibility(View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY | View.SYSTEM_UI_FLAG_FULLSCREEN
        | View.SYSTEM_UI_FLAG_HIDE_NAVIGATION | View.SYSTEM_UI_FLAG_LAYOUT_STABLE
        | View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN);
  }

  @Override public void onWindowFocusChanged(boolean focus) { super.onWindowFocusChanged(focus); if (focus) immersive(); }

  // the Back button works like Escape in the game (pause, close a menu)
  @Override public void onBackPressed() {
    web.evaluateJavascript("for(const t of ['keydown','keyup'])window.dispatchEvent(new KeyboardEvent(t,{code:'Escape',key:'Escape',bubbles:true}));", null);
  }

  // a backup file picked with GameStore.pickBackup(): hand its text to the page
  @Override protected void onActivityResult(int req, int res, Intent data) {
    super.onActivityResult(req, res, data);
    if (req != GameStore.PICK || res != RESULT_OK || data == null || data.getData() == null) return;
    try {
      InputStream in = getContentResolver().openInputStream(data.getData());
      BufferedReader r = new BufferedReader(new InputStreamReader(in, "UTF-8"));
      StringBuilder sb = new StringBuilder(); char[] buf = new char[8192]; int n;
      while ((n = r.read(buf)) > 0 && sb.length() < 4000000) sb.append(buf, 0, n);
      r.close();
      web.evaluateJavascript("window.__gdbdBackupFile && window.__gdbdBackupFile(" + JSONObject.quote(sb.toString()) + ")", null);
    } catch (Exception e) { }
  }

  @Override protected void onPause() { super.onPause(); web.onPause(); }
  @Override protected void onResume() { super.onResume(); web.onResume(); immersive(); }
}
