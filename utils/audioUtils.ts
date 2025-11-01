

const SAMPLE_RATE = 24000;
const BITS_PER_SAMPLE = 16;
const NUM_CHANNELS = 1;
const BYTES_PER_SAMPLE = BITS_PER_SAMPLE / 8;

// Decodes a base64 string into a Uint8Array.
export function decode(base64: string): Uint8Array {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

// Creates a WAV file Blob from raw PCM data (16-bit, 24kHz, mono).
export function createWavBlob(pcmData: Uint8Array): Blob {
  const byteRate = SAMPLE_RATE * NUM_CHANNELS * BYTES_PER_SAMPLE;
  const blockAlign = NUM_CHANNELS * BYTES_PER_SAMPLE;
  const dataSize = pcmData.length;
  const fileSize = 36 + dataSize;

  const buffer = new ArrayBuffer(44);
  const view = new DataView(buffer);

  // RIFF header
  writeString(view, 0, 'RIFF');
  view.setUint32(4, fileSize, true);
  writeString(view, 8, 'WAVE');

  // fmt sub-chunk
  writeString(view, 12, 'fmt ');
  view.setUint32(16, 16, true); // Sub-chunk size
  view.setUint16(20, 1, true); // Audio format (1 for PCM)
  view.setUint16(22, NUM_CHANNELS, true);
  view.setUint32(24, SAMPLE_RATE, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, BITS_PER_SAMPLE, true);

  // data sub-chunk
  writeString(view, 36, 'data');
  view.setUint32(40, dataSize, true);

  return new Blob([view, pcmData], { type: 'audio/wav' });
}

function writeString(view: DataView, offset: number, string: string) {
  for (let i = 0; i < string.length; i++) {
    view.setUint8(offset + i, string.charCodeAt(i));
  }
}

// Creates a silent PCM data buffer for a given duration in seconds.
export function createSilence(durationSeconds: number): Uint8Array {
  if (durationSeconds <= 0) {
    return new Uint8Array(0);
  }
  const numberOfSamples = Math.round(durationSeconds * SAMPLE_RATE);
  const buffer = new ArrayBuffer(numberOfSamples * BYTES_PER_SAMPLE);
  // The buffer is initialized to zeros, which represents silence for PCM data.
  return new Uint8Array(buffer);
}

// Concatenates multiple Uint8Array PCM buffers into one.
export function concatenatePcm(buffers: Uint8Array[]): Uint8Array {
  const totalLength = buffers.reduce((acc, val) => acc + val.length, 0);
  const result = new Uint8Array(totalLength);
  let offset = 0;
  for (const buffer of buffers) {
    result.set(buffer, offset);
    offset += buffer.length;
  }
  return result;
}

// Calculates the duration of a PCM data buffer in seconds.
export function getPcmDuration(pcmData: Uint8Array): number {
    const bytesPerSecond = SAMPLE_RATE * NUM_CHANNELS * BYTES_PER_SAMPLE;
    if (bytesPerSecond === 0) return 0;
    return pcmData.length / bytesPerSecond;
}