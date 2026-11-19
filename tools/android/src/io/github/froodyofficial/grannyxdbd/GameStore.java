package io.github.froodyofficial.grannyxdbd;

import android.app.Activity;
import android.content.ContentValues;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.net.Uri;
import android.os.Build;
import android.webkit.JavascriptInterface;
import java.io.OutputStream;

// A copy of the game's saves (profile, settings) in the app's own storage, next to the WebView's browser storage,
// so progress survives anything that clears the WebView data. Exposed to the page as window.GameStore.
// 1.5.1: also the backup code as a file in Download/Granny x DBD (Android 10+), which stays when the app is uninstalled;
// a reinstalled app can't read it by itself, so pickBackup() opens the system file picker (the answer goes to the page's
// window.__gdbdBackupFile through MainActivity.onActivityResult).
public class GameStore {
  static final int PICK = 7301;
  private final SharedPreferences prefs;
  private final Activity act;
  public GameStore(Activity a) { act = a; prefs = a.getSharedPreferences("gdbd_saves", Context.MODE_PRIVATE); }
  private static boolean ok(String k) { return "profile".equals(k) || "settings".equals(k); }
  @JavascriptInterface public String load(String k) { return ok(k) ? prefs.getString(k, null) : null; }
  @JavascriptInterface public void save(String k, String v) { if (ok(k) && v != null && v.length() < 4000000) prefs.edit().putString(k, v).apply(); }

  @JavascriptInterface public boolean writeBackup(String text) {
    if (text == null || !text.startsWith("GDBD1:") || text.length() > 4000000 || Build.VERSION.SDK_INT < 29) return false;
    try {
      Uri uri = null;
      String saved = prefs.getString("backupUri", null);
      if (saved != null) uri = Uri.parse(saved);
      OutputStream out = null;
      if (uri != null) { try { out = act.getContentResolver().openOutputStream(uri, "wt"); } catch (Exception e) { out = null; } }
      if (out == null) {
        ContentValues v = new ContentValues();
        v.put("_display_name", "Granny x DBD backup.txt");
        v.put("mime_type", "text/plain");
        v.put("relative_path", "Download/Granny x DBD");
        uri = act.getContentResolver().insert(Uri.parse("content://media/external/downloads"), v);
        if (uri == null) return false;
        prefs.edit().putString("backupUri", uri.toString()).apply();
        out = act.getContentResolver().openOutputStream(uri, "wt");
      }
      out.write(text.getBytes("UTF-8"));
      out.close();
      return true;
    } catch (Exception e) { prefs.edit().remove("backupUri").apply(); return false; }
  }

  @JavascriptInterface public void pickBackup() {
    act.runOnUiThread(new Runnable() { public void run() {
      try {
        Intent i = new Intent(Intent.ACTION_OPEN_DOCUMENT);
        i.addCategory(Intent.CATEGORY_OPENABLE);
        i.setType("*/*");
        act.startActivityForResult(i, PICK);
      } catch (Exception e) { }
    } });
  }
}
