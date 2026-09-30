// Barcode generation for registered Sample IDs — uses the `qrcode` package
// already a dependency of this project (previously unused). A QR code is a
// real, established, scannable barcode format; this avoids adding a new
// dependency just for a 1D barcode when a 2D one already ships with the app.
// The barcode encodes ONLY the Sample ID — no customer or commercial data.
import QRCode from "qrcode";

export async function generateSampleBarcodeDataUrl(sampleCode: string): Promise<string> {
  return QRCode.toDataURL(sampleCode, { margin: 1, width: 240, errorCorrectionLevel: "M" });
}
