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

interface TextObservation {
  text: string;
  confidence: number;
  x: number;       // x coordinate from Vision Framework (0.0-1.0)
  y: number;       // y coordinate from Vision Framework (0.0-1.0, bottom-left origin)
  width: number;   // width from Vision Framework (0.0-1.0)
  height: number;  // height from Vision Framework (0.0-1.0)
}

declare class OCRResult {
  text: string;
  confidence: number;

  /**
   * Get text observations with native macOS coordinates (bottom-left origin)
   * Coordinates are exactly as returned by Vision Framework without any conversion
   */
  getObservations(): TextObservation[];
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

  /**
   * Perform OCR text recognition on image buffer
   * @param imageBuffer - Image buffer data
   * @param options - OCR options
   */
  static recognizeFromBuffer(
    imageBuffer: Buffer | Uint8Array,
    options?: RecognizeOptions,
  ): Promise<OCRResult>;

  /**
   * Perform batch OCR text recognition on image buffers
   * @param imageBuffers - Array of image buffer data
   * @param options - Batch OCR options
   */
  static recognizeBatchFromBuffer(
    imageBuffers: Array<Buffer | Uint8Array>,
    options?: RecognizeBatchOptions,
  ): Promise<OCRResult[]>;
}

export { RecognizeOptions, RecognizeBatchOptions, OCRResult, TextObservation };

export default MacOCR;
