interface RecognizeOptions {
  languages?: string;
  recognitionLevel?:
    | typeof MacOCR.RECOGNITION_LEVEL_FAST
    | typeof MacOCR.RECOGNITION_LEVEL_ACCURATE;
  minConfidence?: number;
}

interface RecognizeBatchOptions {
  ocrOptions?: RecognizeOptions;
  maxThreads?: number;
  batchSize?: number;
}

interface OCRResult {
  text: string;
  confidence: number;
}

declare class MacOCR {
  static readonly RECOGNITION_LEVEL_FAST: 0;
  static readonly RECOGNITION_LEVEL_ACCURATE: 1;

  /**
   * Perform OCR text recognition
   * @param imagePath - Image file path
   * @param options - OCR options
   */
  static recognizeFromPath(
    imagePath: string,
    options?: RecognizeOptions,
  ): Promise<OCRResult>;

  /**
   * Batch OCR text recognition
   * @param imagePaths - Image file path array
   * @param options - Batch processing options
   */
  static recognizeBatchFromPath(
    imagePaths: string[],
    options?: RecognizeBatchOptions,
  ): Promise<OCRResult[]>;

  static recognizeFromBuffer(
    imageBuffer: Buffer | Uint8Array,
    options?: RecognizeOptions,
  ): Promise<OCRResult>;
}

export { RecognizeOptions, RecognizeBatchOptions, OCRResult };

export default MacOCR;
