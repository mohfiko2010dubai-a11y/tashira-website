import { parentPort, workerData } from 'node:worker_threads';
import sharp from 'sharp';
import libheif from 'libheif-js/wasm-bundle.js';

// CPU-heavy decoding stays off the API event loop. Only converted bytes leave
// the worker; original HEIF bytes and metadata are never persisted or logged.
const MAX_PIXELS = 80_000_000;
const TARGET_BYTES = 3 * 1024 * 1024;
try {
  const bytes = Buffer.from(workerData.bytes);
  const heif = workerData.mimeType.startsWith('image/hei');
  let pipeline;
  if (heif) {
    const decoder = new libheif.HeifDecoder();
    const images = decoder.decode(bytes);
    const frame = images[0];
    if (!frame) throw new Error('Unreadable');
    const width = frame.get_width();
    const height = frame.get_height();
    if (width <= 0 || height <= 0 || width * height > MAX_PIXELS) throw new Error('Dimensions');
    const decoded = await new Promise((resolve, reject) => frame.display({ width, height, data: new Uint8ClampedArray(width * height * 4) }, result => result ? resolve(result) : reject(new Error('Unreadable'))));
    pipeline = sharp(decoded.data, { raw: { width, height, channels: 4 }, limitInputPixels: MAX_PIXELS });
  } else {
    pipeline = sharp(bytes, { limitInputPixels: MAX_PIXELS, failOn: 'error' });
    const metadata = await pipeline.metadata();
    if (!['jpeg', 'png'].includes(metadata.format)) throw new Error('Unreadable');
    if (bytes.length <= TARGET_BYTES) {
      // Decode once even on the small-file path, so corrupt images cannot be
      // recorded as successfully received.
      await pipeline.clone().stats();
      parentPort.postMessage({ bytes, mimeType: metadata.format === 'png' ? 'image/png' : 'image/jpeg', converted: false });
      process.exit(0);
    }
  }
  let output = await pipeline.rotate().resize({ width: 3000, height: 3000, fit: 'inside', withoutEnlargement: true }).flatten({ background: '#ffffff' }).jpeg({ quality: 85, mozjpeg: true }).toBuffer();
  if (output.length > TARGET_BYTES) output = await sharp(output).resize({ width: 2400, height: 2400, fit: 'inside', withoutEnlargement: true }).jpeg({ quality: 75, mozjpeg: true }).toBuffer();
  parentPort.postMessage({ bytes: output, mimeType: 'image/jpeg', converted: true });
} catch {
  parentPort.postMessage({ error: 'PHOTO_UNREADABLE' });
}
