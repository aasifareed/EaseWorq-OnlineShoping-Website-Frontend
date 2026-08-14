import { Capacitor } from '@capacitor/core';
import { Directory, Filesystem } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';

/** True inside the Capacitor Android/iOS shell. */
export function isNativeApp(): boolean {
  return Capacitor.isNativePlatform();
}

async function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error || new Error('Failed to read PDF'));
    reader.onload = () => {
      const dataUrl = String(reader.result || '');
      const base64 = dataUrl.includes(',') ? dataUrl.split(',')[1] : dataUrl;
      if (!base64) {
        reject(new Error('Empty PDF data'));
        return;
      }
      resolve(base64);
    };
    reader.readAsDataURL(blob);
  });
}

/**
 * WebView cannot download blob URLs or open them in a new tab.
 * Save under app Documents and open the system share sheet so the user can
 * save / open the receipt in a PDF viewer.
 */
export async function saveAndShareNativePdf(
  blob: Blob,
  fileName: string,
  dialogTitle = 'Order receipt',
): Promise<{ savedPath: string }> {
  if (!isNativeApp()) {
    throw new Error('Native PDF save is only available in the mobile app.');
  }

  const safeName = (fileName || 'receipt.pdf').replace(/[^\w.\-]+/g, '_');
  const relativePath = `SastaKhareedo/${safeName}`;
  const base64 = await blobToBase64(blob);

  await Filesystem.writeFile({
    path: relativePath,
    data: base64,
    directory: Directory.Documents,
    recursive: true,
  });

  const { uri } = await Filesystem.getUri({
    path: relativePath,
    directory: Directory.Documents,
  });

  if (Capacitor.isPluginAvailable('Share')) {
    await Share.share({
      title: dialogTitle,
      text: safeName,
      files: [uri],
      dialogTitle,
    });
  }

  return { savedPath: `Documents/${relativePath}` };
}

/** Browser fallback: trigger a normal file download. */
export function downloadBlobInBrowser(blob: Blob, fileName: string): void {
  const url = window.URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  window.setTimeout(() => window.URL.revokeObjectURL(url), 1500);
}

/** Browser fallback: open PDF in a new tab. */
export function previewBlobInBrowser(blob: Blob): boolean {
  const url = window.URL.createObjectURL(blob);
  const previewWindow = window.open(url, '_blank');
  if (!previewWindow) {
    window.URL.revokeObjectURL(url);
    return false;
  }
  previewWindow.addEventListener('unload', () => window.URL.revokeObjectURL(url));
  return true;
}
