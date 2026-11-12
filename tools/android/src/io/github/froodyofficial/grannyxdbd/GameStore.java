package io.github.froodyofficial.grannyxdbd;

import android.content.Context;
import android.content.SharedPreferences;
import android.webkit.JavascriptInterface;

// A copy of the game's saves (profile, settings) in the app's own storage, next to the WebView's browser storage,
// so progress survives anything that clears the WebView data. Exposed to the page as window.GameStore.
public class GameStore {
  private final SharedPreferences prefs;
  public GameStore(Context c) { prefs = c.getSharedPreferences("gdbd_saves", Context.MODE_PRIVATE); }
  private static boolean ok(String k) { return "profile".equals(k) || "settings".equals(k); }
  @JavascriptInterface public String load(String k) { return ok(k) ? prefs.getString(k, null) : null; }
  @JavascriptInterface public void save(String k, String v) { if (ok(k) && v != null && v.length() < 4000000) prefs.edit().putString(k, v).apply(); }
}
