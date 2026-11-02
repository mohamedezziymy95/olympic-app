package ma.edu.alwifaq.olympiadclub;

import android.app.Activity;
import android.content.Context;
import android.graphics.Bitmap;
import android.graphics.Color;
import android.graphics.Matrix;
import android.graphics.pdf.PdfRenderer;
import android.net.Uri;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.os.ParcelFileDescriptor;
import android.view.Gravity;
import android.view.MotionEvent;
import android.view.ScaleGestureDetector;
import android.view.View;
import android.view.ViewGroup;
import android.widget.Button;
import android.widget.ImageView;
import android.widget.LinearLayout;
import android.widget.ScrollView;
import android.widget.TextView;
import android.widget.Toast;

import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.util.ArrayList;

public final class PdfActivity extends Activity {
    public static final String EXTRA_ASSET_PATH = "asset_path";
    public static final String EXTRA_REMOTE_URL = "remote_url";
    private static final long MAX_PDF_BYTES = 40L * 1024L * 1024L;
    private final Handler handler = new Handler(Looper.getMainLooper());
    private final ArrayList<PageSlot> pageSlots = new ArrayList<>();
    private PdfRenderer renderer;
    private ParcelFileDescriptor descriptor;
    private File openedFile;
    private LinearLayout pageStack;
    private ScrollView documentScroll;
    private TextView pageLabel;
    private TextView zoomLabel;
    private Button previous;
    private Button next;
    private int pageIndex;
    private int pageCount;
    private Runnable renderRunnable;

    @Override
    protected void onCreate(Bundle state) {
        super.onCreate(state);
        getWindow().setStatusBarColor(Color.rgb(16, 36, 58));
        getWindow().setNavigationBarColor(Color.rgb(16, 36, 58));
        buildLayout();
        openPdf(getIntent().getStringExtra(EXTRA_ASSET_PATH), getIntent().getStringExtra(EXTRA_REMOTE_URL));
    }

    private void buildLayout() {
        LinearLayout root = new LinearLayout(this);
        root.setOrientation(LinearLayout.VERTICAL);
        root.setBackgroundColor(Color.rgb(244, 247, 250));

        LinearLayout toolbar = new LinearLayout(this);
        toolbar.setGravity(Gravity.CENTER_VERTICAL);
        toolbar.setPadding(dp(12), dp(6), dp(12), dp(6));
        toolbar.setBackgroundColor(Color.rgb(16, 36, 58));
        TextView title = new TextView(this);
        title.setText("وثيقة النادي");
        title.setTextColor(Color.WHITE);
        title.setTextSize(16);
        title.setGravity(Gravity.CENTER_VERTICAL);
        title.setTypeface(null, 1);
        toolbar.addView(title, new LinearLayout.LayoutParams(0, dp(48), 1));
        Button close = new Button(this);
        close.setText("رجوع");
        close.setTextColor(Color.WHITE);
        close.setBackgroundTintList(android.content.res.ColorStateList.valueOf(Color.rgb(19, 137, 140)));
        close.setOnClickListener(v -> finish());
        toolbar.addView(close, new LinearLayout.LayoutParams(dp(82), dp(42)));
        root.addView(toolbar);

        LinearLayout controls = new LinearLayout(this);
        controls.setGravity(Gravity.CENTER);
        controls.setPadding(dp(4), dp(3), dp(4), dp(3));
        previous = new Button(this);
        previous.setText("السابق");
        previous.setOnClickListener(v -> showPage(pageIndex - 1));
        pageLabel = new TextView(this);
        pageLabel.setGravity(Gravity.CENTER);
        pageLabel.setTextColor(Color.rgb(42, 61, 76));
        pageLabel.setTextSize(12);
        next = new Button(this);
        next.setText("التالي");
        next.setOnClickListener(v -> showPage(pageIndex + 1));
        controls.addView(previous);
        controls.addView(pageLabel, new LinearLayout.LayoutParams(dp(105), dp(46)));
        controls.addView(next);
        root.addView(controls);

        LinearLayout zoomControls = new LinearLayout(this);
        zoomControls.setGravity(Gravity.CENTER);
        zoomControls.setPadding(dp(4), 0, dp(4), dp(4));
        Button zoomOut = new Button(this);
        zoomOut.setText("−");
        zoomOut.setTextSize(20);
        zoomOut.setContentDescription("تصغير الصفحة");
        zoomOut.setOnClickListener(v -> zoomCurrent(0.8f));
        zoomLabel = new TextView(this);
        zoomLabel.setText("100%");
        zoomLabel.setTextColor(Color.rgb(42, 61, 76));
        zoomLabel.setGravity(Gravity.CENTER);
        zoomLabel.setTextSize(12);
        Button fit = new Button(this);
        fit.setText("ملاءمة");
        fit.setOnClickListener(v -> resetZoom());
        Button zoomIn = new Button(this);
        zoomIn.setText("+");
        zoomIn.setTextSize(20);
        zoomIn.setContentDescription("تكبير الصفحة");
        zoomIn.setOnClickListener(v -> zoomCurrent(1.25f));
        zoomControls.addView(zoomOut, new LinearLayout.LayoutParams(dp(60), dp(42)));
        zoomControls.addView(zoomLabel, new LinearLayout.LayoutParams(dp(66), dp(42)));
        zoomControls.addView(fit, new LinearLayout.LayoutParams(dp(86), dp(42)));
        zoomControls.addView(zoomIn, new LinearLayout.LayoutParams(dp(60), dp(42)));
        root.addView(zoomControls);

        TextView gestureHint = new TextView(this);
        gestureHint.setText("مرّر بإصبع واحد · قرّب إصبعين للتكبير");
        gestureHint.setTextColor(Color.rgb(100, 116, 126));
        gestureHint.setTextSize(10);
        gestureHint.setGravity(Gravity.CENTER);
        gestureHint.setPadding(0, 0, 0, dp(5));
        root.addView(gestureHint, new LinearLayout.LayoutParams(-1, -2));

        documentScroll = new ScrollView(this);
        documentScroll.setFillViewport(true);
        documentScroll.setClipToPadding(false);
        pageStack = new LinearLayout(this);
        pageStack.setOrientation(LinearLayout.VERTICAL);
        pageStack.setPadding(dp(10), dp(4), dp(10), dp(18));
        documentScroll.addView(pageStack, new ScrollView.LayoutParams(-1, -2));
        documentScroll.setOnScrollChangeListener((View v, int scrollX, int scrollY, int oldX, int oldY) -> {
            updateCurrentPage();
            scheduleVisibleRender();
        });
        root.addView(documentScroll, new LinearLayout.LayoutParams(-1, 0, 1));
        setContentView(root);
    }

    private void openPdf(String assetPath, String remoteUrl) {
        if (assetPath != null) {
            if (assetPath.contains("..") || assetPath.startsWith("/")) { showError(); return; }
            try {
                File temp = new File(getCacheDir(), "club-resource-" + System.currentTimeMillis() + ".pdf");
                try (InputStream input = getAssets().open("www/" + assetPath);
                     FileOutputStream output = new FileOutputStream(temp)) {
                    copyLimited(input, output);
                }
                openedFile = temp;
                initializeRenderer();
            } catch (Exception ex) { showError(); }
            return;
        }
        if (remoteUrl == null || !isAllowedRemotePdf(remoteUrl)) { showError(); return; }
        Toast.makeText(this, "كنحمّلو الوثيقة…", Toast.LENGTH_SHORT).show();
        new Thread(() -> downloadRemotePdf(remoteUrl)).start();
    }

    private void downloadRemotePdf(String remoteUrl) {
        File temp = new File(getCacheDir(), "club-remote-" + System.currentTimeMillis() + ".pdf");
        HttpURLConnection connection = null;
        try {
            URL url = new URL(remoteUrl);
            connection = (HttpURLConnection) url.openConnection();
            connection.setConnectTimeout(15000);
            connection.setReadTimeout(25000);
            connection.setInstanceFollowRedirects(true);
            connection.setRequestProperty("User-Agent", "OlympiadClubAndroid/1.2");
            int status = connection.getResponseCode();
            if (status < 200 || status >= 300) throw new IllegalStateException("HTTP " + status);
            long length = connection.getContentLengthLong();
            if (length > MAX_PDF_BYTES) throw new IllegalStateException("PDF too large");
            try (InputStream input = connection.getInputStream(); FileOutputStream output = new FileOutputStream(temp)) {
                copyLimited(input, output);
            }
            if (!isPdfFile(temp)) throw new IllegalStateException("Invalid PDF response");
            runOnUiThread(() -> {
                if (isFinishing() || isDestroyed()) { temp.delete(); return; }
                openedFile = temp;
                initializeRenderer();
            });
        } catch (Exception ex) {
            temp.delete();
            runOnUiThread(this::showError);
        } finally {
            if (connection != null) connection.disconnect();
        }
    }

    private boolean isAllowedRemotePdf(String value) {
        try {
            Uri uri = Uri.parse(value);
            return "https".equalsIgnoreCase(uri.getScheme())
                    && "raw.githubusercontent.com".equalsIgnoreCase(uri.getHost())
                    && uri.getPath() != null && uri.getPath().toLowerCase().endsWith(".pdf");
        } catch (Exception ex) { return false; }
    }

    private void copyLimited(InputStream input, FileOutputStream output) throws Exception {
        byte[] buffer = new byte[24 * 1024];
        int read;
        long total = 0;
        while ((read = input.read(buffer)) != -1) {
            total += read;
            if (total > MAX_PDF_BYTES) throw new IllegalStateException("PDF too large");
            output.write(buffer, 0, read);
        }
    }

    private boolean isPdfFile(File file) {
        try (java.io.RandomAccessFile input = new java.io.RandomAccessFile(file, "r")) {
            return input.length() >= 5 && input.readLine().startsWith("%PDF-");
        } catch (Exception ex) { return false; }
    }

    private void initializeRenderer() {
        try {
            descriptor = ParcelFileDescriptor.open(openedFile, ParcelFileDescriptor.MODE_READ_ONLY);
            renderer = new PdfRenderer(descriptor);
            pageCount = renderer.getPageCount();
            if (pageCount <= 0) { showError(); return; }
            createPageSlots();
            updatePageControls();
            documentScroll.post(() -> {
                renderAround(0);
                scheduleVisibleRender();
            });
        } catch (Exception ex) { showError(); }
    }

    private void createPageSlots() {
        pageStack.removeAllViews();
        pageSlots.clear();
        int viewWidth = Math.max(dp(240), getResources().getDisplayMetrics().widthPixels - dp(40));
        int renderWidth = Math.min(1600, Math.max(viewWidth, viewWidth * 2));
        for (int i = 0; i < pageCount; i++) {
            int pageWidth;
            int pageHeight;
            try (PdfRenderer.Page page = renderer.openPage(i)) {
                pageWidth = page.getWidth();
                pageHeight = page.getHeight();
            } catch (Exception ex) { pageWidth = 612; pageHeight = 792; }
            float ratio = Math.max(0.45f, Math.min(2.5f, pageHeight / (float) Math.max(1, pageWidth)));
            int viewHeight = Math.max(1, Math.round(viewWidth * ratio));
            PageSlot slot = new PageSlot(i, renderWidth, viewWidth, viewHeight);
            pageSlots.add(slot);
            LinearLayout.LayoutParams slotParams = new LinearLayout.LayoutParams(-1, -2);
            slotParams.topMargin = dp(8);
            slotParams.bottomMargin = dp(8);
            pageStack.addView(slot.container, slotParams);
        }
    }

    private void scheduleVisibleRender() {
        if (renderRunnable != null) handler.removeCallbacks(renderRunnable);
        renderRunnable = () -> renderAround(pageIndex);
        handler.postDelayed(renderRunnable, 100);
    }

    private void updateCurrentPage() {
        if (pageSlots.isEmpty()) return;
        int marker = documentScroll.getScrollY() + Math.max(1, documentScroll.getHeight() / 2);
        for (PageSlot slot : pageSlots) {
            int top = slot.container.getTop();
            int bottom = top + slot.container.getHeight();
            if (marker >= top && marker < bottom) {
                pageIndex = slot.index;
                break;
            }
        }
        updatePageControls();
    }

    private void updatePageControls() {
        if (pageLabel == null || pageCount == 0) return;
        pageLabel.setText(getString(R.string.pdf_page, pageIndex + 1, pageCount));
        if (previous != null) previous.setEnabled(pageIndex > 0);
        if (next != null) next.setEnabled(pageIndex + 1 < pageCount);
        if (zoomLabel != null && pageIndex < pageSlots.size()) zoomLabel.setText(Math.round(pageSlots.get(pageIndex).image.getZoom() * 100) + "%");
    }

    private void renderAround(int center) {
        if (renderer == null || isFinishing()) return;
        for (PageSlot slot : pageSlots) {
            if (Math.abs(slot.index - center) <= 1) renderPage(slot);
            else slot.clearBitmap();
        }
    }

    private void renderPage(PageSlot slot) {
        if (slot.image.hasBitmap() || renderer == null) return;
        try (PdfRenderer.Page page = renderer.openPage(slot.index)) {
            int width = slot.renderWidth;
            int height = Math.max(1, Math.round(width * page.getHeight() / (float) page.getWidth()));
            Bitmap bitmap = Bitmap.createBitmap(width, height, Bitmap.Config.ARGB_8888);
            bitmap.eraseColor(Color.WHITE);
            page.render(bitmap, null, null, PdfRenderer.Page.RENDER_MODE_FOR_DISPLAY);
            slot.image.setPageBitmap(bitmap, slot.fitScale);
        } catch (OutOfMemoryError error) {
            Toast.makeText(this, "تعذر عرض الصفحة بالحجم الحالي؛ جرّب إعادة فتح الملف.", Toast.LENGTH_LONG).show();
        } catch (Exception ex) {
            Toast.makeText(this, R.string.pdf_error, Toast.LENGTH_SHORT).show();
        }
    }

    private void showPage(int index) {
        if (index < 0 || index >= pageCount || pageSlots.isEmpty()) return;
        pageIndex = index;
        PageSlot slot = pageSlots.get(index);
        renderAround(index);
        documentScroll.smoothScrollTo(0, slot.container.getTop());
        updatePageControls();
    }

    private void zoomCurrent(float factor) {
        if (pageIndex >= 0 && pageIndex < pageSlots.size()) {
            pageSlots.get(pageIndex).image.zoomBy(factor);
            updatePageControls();
        }
    }

    private void resetZoom() {
        if (pageIndex >= 0 && pageIndex < pageSlots.size()) {
            pageSlots.get(pageIndex).image.resetZoom();
            updatePageControls();
        }
    }

    private void showError() {
        Toast.makeText(this, R.string.pdf_error, Toast.LENGTH_LONG).show();
        finish();
    }

    private int dp(int value) { return Math.round(value * getResources().getDisplayMetrics().density); }

    @Override
    protected void onDestroy() {
        if (renderRunnable != null) handler.removeCallbacks(renderRunnable);
        for (PageSlot slot : pageSlots) slot.clearBitmap();
        if (renderer != null) renderer.close();
        if (descriptor != null) try { descriptor.close(); } catch (Exception ignored) { }
        if (openedFile != null) openedFile.delete();
        super.onDestroy();
    }

    private final class PageSlot {
        final int index;
        final int renderWidth;
        final float fitScale;
        final LinearLayout container;
        final ZoomablePage image;
        PageSlot(int index, int renderWidth, int viewWidth, int viewHeight) {
            this.index = index;
            this.renderWidth = renderWidth;
            fitScale = viewWidth / (float) renderWidth;
            container = new LinearLayout(PdfActivity.this);
            container.setOrientation(LinearLayout.VERTICAL);
            container.setBackgroundColor(Color.WHITE);
            container.setElevation(dp(2));
            container.setContentDescription("صفحة " + (index + 1));
            TextView number = new TextView(PdfActivity.this);
            number.setText("صفحة " + (index + 1));
            number.setTextColor(Color.rgb(106, 121, 132));
            number.setTextSize(10);
            number.setGravity(Gravity.CENTER);
            number.setPadding(0, dp(5), 0, dp(5));
            image = new ZoomablePage(PdfActivity.this);
            image.setLayoutParams(new LinearLayout.LayoutParams(-1, viewHeight));
            container.addView(number, new LinearLayout.LayoutParams(-1, dp(28)));
            container.addView(image);
        }
        void clearBitmap() { image.clearPageBitmap(); }
    }

    private final class ZoomablePage extends ImageView {
        private final Matrix matrix = new Matrix();
        private final ScaleGestureDetector scaleDetector;
        private Bitmap bitmap;
        private float zoom = 1f;
        private float fitScale = 1f;
        private float translateX;
        private float translateY;
        private float lastX;
        private float lastY;

        ZoomablePage(Context context) {
            super(context);
            setScaleType(ScaleType.MATRIX);
            setBackgroundColor(Color.WHITE);
            setClickable(true);
            setContentDescription("صفحة PDF؛ اسحب بإصبع واحد للتنقل، وقرّب إصبعين للتكبير");
            scaleDetector = new ScaleGestureDetector(context, new ScaleGestureDetector.SimpleOnScaleGestureListener() {
                @Override public boolean onScale(ScaleGestureDetector detector) {
                    float next = Math.max(1f, Math.min(4.5f, zoom * detector.getScaleFactor()));
                    float factor = next / zoom;
                    float focusX = detector.getFocusX();
                    float focusY = detector.getFocusY();
                    translateX = focusX - (focusX - translateX) * factor;
                    translateY = focusY - (focusY - translateY) * factor;
                    zoom = next;
                    clampTranslation();
                    applyMatrix();
                    updatePageControls();
                    return true;
                }
            });
        }

        boolean hasBitmap() { return bitmap != null && !bitmap.isRecycled(); }
        float getZoom() { return zoom; }
        void setPageBitmap(Bitmap value, float baseScale) { clearPageBitmap(); bitmap = value; fitScale = baseScale; setImageBitmap(value); resetZoom(); }
        void clearPageBitmap() { if (bitmap != null && !bitmap.isRecycled()) bitmap.recycle(); bitmap = null; setImageDrawable(null); zoom = 1f; translateX = translateY = 0f; }
        void resetZoom() { zoom = 1f; translateX = translateY = 0f; applyMatrix(); }
        void zoomBy(float factor) {
            if (!hasBitmap()) return;
            float next = Math.max(1f, Math.min(4.5f, zoom * factor));
            float ratio = next / zoom;
            float centerX = getWidth() / 2f;
            float centerY = getHeight() / 2f;
            translateX = centerX - (centerX - translateX) * ratio;
            translateY = centerY - (centerY - translateY) * ratio;
            zoom = next;
            clampTranslation();
            applyMatrix();
        }
        private void clampTranslation() {
            if (bitmap == null || getWidth() == 0 || getHeight() == 0) return;
            float scaledWidth = bitmap.getWidth() * fitScale * zoom;
            float scaledHeight = bitmap.getHeight() * fitScale * zoom;
            translateX = scaledWidth <= getWidth() ? (getWidth() - scaledWidth) / 2f : Math.max(getWidth() - scaledWidth, Math.min(0f, translateX));
            translateY = scaledHeight <= getHeight() ? (getHeight() - scaledHeight) / 2f : Math.max(getHeight() - scaledHeight, Math.min(0f, translateY));
        }
        private void applyMatrix() {
            matrix.reset();
            matrix.setScale(fitScale * zoom, fitScale * zoom);
            matrix.postTranslate(translateX, translateY);
            setImageMatrix(matrix);
        }
        @Override protected void onSizeChanged(int w, int h, int oldw, int oldh) { super.onSizeChanged(w,h,oldw,oldh); clampTranslation(); applyMatrix(); }
        @Override public boolean onTouchEvent(MotionEvent event) {
            scaleDetector.onTouchEvent(event);
            switch (event.getActionMasked()) {
                case MotionEvent.ACTION_DOWN:
                    lastX = event.getX(); lastY = event.getY();
                    if (zoom > 1f) getParent().requestDisallowInterceptTouchEvent(true);
                    return true;
                case MotionEvent.ACTION_POINTER_DOWN:
                    getParent().requestDisallowInterceptTouchEvent(true);
                    return true;
                case MotionEvent.ACTION_MOVE:
                    if (event.getPointerCount() == 1 && zoom > 1f) {
                        float x = event.getX(); float y = event.getY();
                        translateX += x - lastX; translateY += y - lastY;
                        lastX = x; lastY = y;
                        clampTranslation(); applyMatrix();
                        getParent().requestDisallowInterceptTouchEvent(true);
                    }
                    return true;
                case MotionEvent.ACTION_POINTER_UP: {
                    int liftedIndex = event.getActionIndex();
                    int remainingIndex = liftedIndex == 0 && event.getPointerCount() > 1 ? 1 : 0;
                    lastX = event.getX(remainingIndex); lastY = event.getY(remainingIndex);
                    return true;
                }
                case MotionEvent.ACTION_UP:
                case MotionEvent.ACTION_CANCEL:
                    getParent().requestDisallowInterceptTouchEvent(false);
                    if (event.getActionMasked() == MotionEvent.ACTION_UP) performClick();
                    return true;
                default: return true;
            }
        }
        @Override public boolean performClick() { super.performClick(); return true; }
    }
}
