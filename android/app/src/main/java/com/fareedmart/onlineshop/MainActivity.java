package com.fareedmart.onlineshop;

import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebView;
import com.getcapacitor.BridgeActivity;
import com.getcapacitor.BridgeWebViewClient;
import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.util.Locale;
import java.util.Map;

public class MainActivity extends BridgeActivity {

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        rewriteProductAppLinkIntent(getIntent());
        super.onCreate(savedInstanceState);
    }

    @Override
    protected void onNewIntent(Intent intent) {
        rewriteProductAppLinkIntent(intent);
        setIntent(intent);
        super.onNewIntent(intent);
    }

    /**
     * Keep App Links inside the Capacitor SPA (hostname sastakhareedo.com).
     * Beta hash URLs are https://beta.sastakhareedo.com/#/shop/product/{slug} — path is "/",
     * product is in the fragment. PayFast return URLs are left unchanged.
     */
    private void rewriteProductAppLinkIntent(Intent intent) {
        if (intent == null) {
            return;
        }
        Uri uri = intent.getData();
        if (uri == null) {
            return;
        }

        String host = uri.getHost() == null ? "" : uri.getHost().toLowerCase(Locale.US);
        String path = uri.getPath() == null ? "" : uri.getPath();
        String fragment = uri.getFragment() == null ? "" : uri.getFragment();
        String lowerPath = path.toLowerCase(Locale.US);
        String lowerFragment = fragment.toLowerCase(Locale.US);

        if (lowerPath.contains("payfast-return")
                || lowerPath.contains("/shop/checkout/")
                || lowerFragment.contains("shop/checkout")
                || lowerFragment.contains("payfast-return")) {
            return;
        }

        String slug = productSlugFromUri(uri);
        String query = uri.getEncodedQuery();
        if (slug != null && !slug.isEmpty()) {
            String dest = "https://sastakhareedo.com/#/shop/product/" + slug;
            if (query != null && !query.isEmpty()) {
                dest += "?" + query;
            }
            intent.setData(Uri.parse(dest));
            return;
        }

        // Domain-level beta links: stay on the local WebView origin, keep the hash route.
        if ("beta.sastakhareedo.com".equals(host) && !fragment.isEmpty()) {
            String hash = fragment.startsWith("/") ? fragment : "/" + fragment;
            String dest = "https://sastakhareedo.com/#" + hash;
            if (query != null && !query.isEmpty() && !hash.contains("?")) {
                dest += "?" + query;
            }
            intent.setData(Uri.parse(dest));
        }
    }

    private static String productSlugFromUri(Uri uri) {
        String fromPath = productSlugFromPath(uri.getPath());
        if (fromPath != null) {
            return fromPath;
        }
        String fragment = uri.getFragment();
        if (fragment == null || fragment.isEmpty()) {
            return null;
        }
        int q = fragment.indexOf('?');
        if (q >= 0) {
            fragment = fragment.substring(0, q);
        }
        if (!fragment.startsWith("/")) {
            fragment = "/" + fragment;
        }
        return productSlugFromPath(fragment);
    }

    private static String productSlugFromPath(String path) {
        if (path == null || path.isEmpty()) {
            return null;
        }
        String normalized = path;
        if (normalized.endsWith("/") && normalized.length() > 1) {
            normalized = normalized.substring(0, normalized.length() - 1);
        }
        String lower = normalized.toLowerCase(Locale.US);
        String prefix = "/shop/product/";
        if (!lower.startsWith(prefix)) {
            return null;
        }
        String slug = normalized.substring(prefix.length());
        if (slug.toLowerCase(Locale.US).startsWith("left/sidebar/")) {
            slug = slug.substring("left/sidebar/".length());
        }
        int slash = slug.indexOf('/');
        if (slash >= 0) {
            slug = slug.substring(0, slash);
        }
        return slug.isEmpty() ? null : slug;
    }

    @Override
    protected void load() {
        super.load();
        if (this.bridge == null) {
            return;
        }

        this.bridge.setWebViewClient(new BridgeWebViewClient(this.bridge) {
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                if (request != null && handlePayFastReturn(view, request.getUrl())) {
                    return true;
                }
                return super.shouldOverrideUrlLoading(view, request);
            }

            @Override
            public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
                if (request != null && !request.isForMainFrame()) {
                    WebResourceResponse nativeResponse = fetchTunnelResource(request);
                    if (nativeResponse != null) {
                        return nativeResponse;
                    }
                }
                return super.shouldInterceptRequest(view, request);
            }

            @Override
            public void onPageFinished(WebView view, String url) {
                super.onPageFinished(view, url);
                autoContinueDevTunnel(view, url);
            }
        });
    }

    /** PayFast GET return → in-app hash route (never the Host tunnel). */
    private boolean handlePayFastReturn(WebView view, Uri uri) {
        if (view == null || uri == null) {
            return false;
        }
        String path = uri.getPath();
        if (path == null || !path.contains("payfast-return")) {
            return false;
        }
        String query = uri.getEncodedQuery();
        String dest = "https://sastakhareedo.com/#/shop/checkout/payfast-return";
        if (query != null && !query.isEmpty()) {
            dest += "?" + query;
        }
        view.loadUrl(dest);
        return true;
    }

    /**
     * Dev Tunnel interstitial blocks WebView &lt;img&gt; tags. Native HTTP (non-browser UA)
     * can still reach the files, same as CapacitorHttp for the API.
     */
    private WebResourceResponse fetchTunnelResource(WebResourceRequest request) {
        Uri uri = request.getUrl();
        if (uri == null) {
            return null;
        }
        String host = uri.getHost() == null ? "" : uri.getHost().toLowerCase(Locale.US);
        if (!host.endsWith("devtunnels.ms")
                && !host.endsWith("ngrok-free.app")
                && !host.endsWith("ngrok.io")) {
            return null;
        }

        HttpURLConnection conn = null;
        try {
            conn = (HttpURLConnection) new URL(uri.toString()).openConnection();
            conn.setInstanceFollowRedirects(true);
            conn.setConnectTimeout(15000);
            conn.setReadTimeout(25000);
            String method = request.getMethod();
            conn.setRequestMethod(method == null || method.isEmpty() ? "GET" : method);
            conn.setRequestProperty("User-Agent", "SastaKhareedo-Android/1.0");
            Map<String, String> headers = request.getRequestHeaders();
            if (headers != null) {
                for (Map.Entry<String, String> entry : headers.entrySet()) {
                    String key = entry.getKey();
                    if (key == null) {
                        continue;
                    }
                    String lower = key.toLowerCase(Locale.US);
                    if (lower.equals("user-agent") || lower.equals("host")) {
                        continue;
                    }
                    conn.setRequestProperty(key, entry.getValue());
                }
            }

            int code = conn.getResponseCode();
            InputStream raw = code >= 400 ? conn.getErrorStream() : conn.getInputStream();
            byte[] body = readAll(raw);
            String contentType = conn.getContentType();
            String mime = "application/octet-stream";
            String encoding = null;
            if (contentType != null && !contentType.isEmpty()) {
                String[] parts = contentType.split(";");
                mime = parts[0].trim();
                for (int i = 1; i < parts.length; i++) {
                    String part = parts[i].trim();
                    if (part.toLowerCase(Locale.US).startsWith("charset=")) {
                        encoding = part.substring(8).trim();
                    }
                }
            } else {
                mime = guessMime(uri.getPath());
            }
            return new WebResourceResponse(mime, encoding, new ByteArrayInputStream(body));
        } catch (Exception ignored) {
            return null;
        } finally {
            if (conn != null) {
                conn.disconnect();
            }
        }
    }

    private static byte[] readAll(InputStream stream) throws Exception {
        if (stream == null) {
            return new byte[0];
        }
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        byte[] buffer = new byte[8192];
        int read;
        while ((read = stream.read(buffer)) != -1) {
            out.write(buffer, 0, read);
        }
        stream.close();
        return out.toByteArray();
    }

    private static String guessMime(String path) {
        if (path == null) {
            return "application/octet-stream";
        }
        String lower = path.toLowerCase(Locale.US);
        if (lower.endsWith(".png")) {
            return "image/png";
        }
        if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) {
            return "image/jpeg";
        }
        if (lower.endsWith(".webp")) {
            return "image/webp";
        }
        if (lower.endsWith(".gif")) {
            return "image/gif";
        }
        if (lower.endsWith(".svg")) {
            return "image/svg+xml";
        }
        return "application/octet-stream";
    }

    /**
     * Backup only: local Host via Dev Tunnels shows a Microsoft interstitial.
     * PayFast return now uses a local HTML page; this still helps other tunnel hits.
     */
    private void autoContinueDevTunnel(WebView view, String url) {
        if (view == null) {
            return;
        }

        view.evaluateJavascript(
            "(function(){"
                + "if(window.__skTunnelContinueStarted){return;}"
                + "window.__skTunnelContinueStarted=true;"
                + "var tries=0;"
                + "var timer=setInterval(function(){"
                + "tries++;"
                + "var text=((document.body&&document.body.innerText)||'').toLowerCase();"
                + "var onTunnel=text.indexOf('developer tunnel')>=0||text.indexOf('dev tunnel')>=0"
                + "||String(location.href||'').toLowerCase().indexOf('devtunnels.ms')>=0;"
                + "if(onTunnel){"
                + "var nodes=document.querySelectorAll('button,a,input[type=submit],input[type=button]');"
                + "for(var i=0;i<nodes.length;i++){"
                + "var t=((nodes[i].innerText||nodes[i].textContent||nodes[i].value||'')+'').toLowerCase();"
                + "if(t.indexOf('continue')>=0){nodes[i].click();clearInterval(timer);return;}"
                + "}"
                + "var form=document.querySelector('form');"
                + "if(form){form.submit();clearInterval(timer);return;}"
                + "}"
                + "if(tries>=25){clearInterval(timer);}"
                + "},300);"
                + "})();",
            null
        );
    }
}
