package ma.edu.alwifaq.olympiadclub;

import android.app.Activity;
import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.graphics.Color;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.view.WindowInsets;
import android.webkit.CookieManager;
import android.webkit.MimeTypeMap;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Toast;

import java.io.FileNotFoundException;
import java.io.InputStream;
import java.net.URLDecoder;
import java.nio.charset.StandardCharsets;
import java.util.Collections;
import java.util.HashMap;
import java.util.Map;

public final class MainActivity extends Activity {
    private static final String APP_HOST = "appassets.androidplatform.net";
    private static final String START_URL = "https://" + APP_HOST + "/index.html#home";
    private WebView webView;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        getWindow().setStatusBarColor(Color.rgb(16, 36, 58));
        getWindow().setNavigationBarColor(Color.rgb(16, 36, 58));
        getWindow().getDecorView().setSystemUiVisibility(0);

        webView = new WebView(this);
        webView.setBackgroundColor(Color.rgb(244, 247, 250));
        setContentView(webView);
        applySystemInsets();

        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setDatabaseEnabled(true);
        settings.setAllowFileAccess(false);
        settings.setAllowContentAccess(false);
        settings.setJavaScriptCanOpenWindowsAutomatically(false);
        settings.setSupportMultipleWindows(false);
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        settings.setUserAgentString(settings.getUserAgentString() + " OlympiadClubAndroid");
        CookieManager.getInstance().setAcceptCookie(true);

        webView.setWebChromeClient(new WebChromeClient());
        webView.setWebViewClient(new WebViewClient() {
            @Override
            public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
                Uri uri = request.getUrl();
                if (!"https".equalsIgnoreCase(uri.getScheme()) || !APP_HOST.equalsIgnoreCase(uri.getHost())) {
                    return super.shouldInterceptRequest(view, request);
                }
                return serveAsset(uri.getPath());
            }

            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                return handleNavigation(request.getUrl());
            }

            @Override
            public boolean shouldOverrideUrlLoading(WebView view, String url) {
                return handleNavigation(Uri.parse(url));
            }
        });

        if (savedInstanceState != null) webView.restoreState(savedInstanceState);
        else webView.loadUrl(START_URL);
    }

    private void applySystemInsets() {
        if (Build.VERSION.SDK_INT >= 35) {
            getWindow().getDecorView().setOnApplyWindowInsetsListener((view, insets) -> {
                android.graphics.Insets bars = insets.getInsets(WindowInsets.Type.systemBars());
                webView.setPadding(bars.left, bars.top, bars.right, bars.bottom);
                return insets;
            });
        }
    }

    private WebResourceResponse serveAsset(String requestedPath) {
        String path;
        try {
            path = URLDecoder.decode(requestedPath == null ? "/" : requestedPath, StandardCharsets.UTF_8.name());
        } catch (Exception ex) {
            return errorResponse(400, "Bad request");
        }
        if (path.isEmpty() || "/".equals(path)) path = "/index.html";
        if (path.contains("..") || path.startsWith("//")) return errorResponse(403, "Forbidden");
        String relative = path.replaceFirst("^/+", "");
        String type = mimeType(relative);
        try {
            InputStream stream = getAssets().open("www/" + relative);
            Map<String, String> headers = new HashMap<>();
            headers.put("Cache-Control", "no-cache");
            headers.put("X-Content-Type-Options", "nosniff");
            return new WebResourceResponse(type, "UTF-8", 200, "OK", headers, stream);
        } catch (FileNotFoundException ex) {
            return errorResponse(404, "Not found");
        } catch (Exception ex) {
            return errorResponse(500, "Unable to load app file");
        }
    }

    private WebResourceResponse errorResponse(int code, String message) {
        Map<String, String> headers = Collections.singletonMap("Cache-Control", "no-store");
        return new WebResourceResponse("text/plain", "UTF-8", code, message, headers,
                new java.io.ByteArrayInputStream(message.getBytes(StandardCharsets.UTF_8)));
    }

    private String mimeType(String path) {
        String lower = path.toLowerCase();
        if (lower.endsWith(".webmanifest")) return "application/manifest+json";
        if (lower.endsWith(".json")) return "application/json";
        if (lower.endsWith(".js")) return "text/javascript";
        if (lower.endsWith(".css")) return "text/css";
        if (lower.endsWith(".svg")) return "image/svg+xml";
        if (lower.endsWith(".pdf")) return "application/pdf";
        String ext = MimeTypeMap.getFileExtensionFromUrl(path);
        String type = MimeTypeMap.getSingleton().getMimeTypeFromExtension(ext);
        return type == null ? "application/octet-stream" : type;
    }

    private boolean handleNavigation(Uri uri) {
        String scheme = uri.getScheme() == null ? "" : uri.getScheme().toLowerCase();
        String host = uri.getHost() == null ? "" : uri.getHost().toLowerCase();
        String path = uri.getPath() == null ? "" : uri.getPath();
        if ("https".equals(scheme) && APP_HOST.equals(host)) {
            if (path.toLowerCase().endsWith(".pdf")) {
                String assetPath = path.replaceFirst("^/+", "");
                if (assetPath.contains("..")) return true;
                Intent intent = new Intent(this, PdfActivity.class);
                intent.putExtra(PdfActivity.EXTRA_ASSET_PATH, assetPath);
                startActivity(intent);
                return true;
            }
            return false;
        }
        if ("https".equals(scheme) && "raw.githubusercontent.com".equals(host)
                && path.toLowerCase().endsWith(".pdf")) {
            Intent intent = new Intent(this, PdfActivity.class);
            intent.putExtra(PdfActivity.EXTRA_REMOTE_URL, uri.toString());
            startActivity(intent);
            return true;
        }
        if ("https".equals(scheme) || "http".equals(scheme) || "mailto".equals(scheme) || "tel".equals(scheme)) {
            try {
                startActivity(new Intent(Intent.ACTION_VIEW, uri));
            } catch (ActivityNotFoundException ex) {
                Toast.makeText(this, "ما كاينش تطبيق مناسب لفتح هاد الرابط.", Toast.LENGTH_SHORT).show();
            }
            return true;
        }
        return true;
    }

    @Override
    protected void onSaveInstanceState(Bundle outState) {
        if (webView != null) webView.saveState(outState);
        super.onSaveInstanceState(outState);
    }

    @Override
    public void onBackPressed() {
        if (webView != null && webView.canGoBack()) webView.goBack();
        else super.onBackPressed();
    }

    @Override
    protected void onDestroy() {
        if (webView != null) {
            webView.stopLoading();
            webView.setWebChromeClient(null);
            webView.setWebViewClient(null);
            webView.destroy();
            webView = null;
        }
        super.onDestroy();
    }
}
