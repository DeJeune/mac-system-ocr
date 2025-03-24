const { recognize, recognizeBatch } = require('bindings')('mac_system_ocr');
const path = require('path');
const fs = require('fs');
const os = require('os');

// Check operating system requirements
const platform = os.platform();
const release = os.release();

if (platform !== 'darwin') {
  throw new Error('This module only works on macOS');
}

// Parse macOS version (e.g., "19.0.0" -> 10.15)
const majorVersion = parseInt(release.split('.')[0], 10);
if (majorVersion < 19) { // MacOS 10.15 (Catalina) corresponds to Darwin 19.0.0
  throw new Error('This module requires macOS 10.15 (Catalina) or higher');
}

class MacOCR {
  // OCR recognition level constants
  static get RECOGNITION_LEVEL_FAST() { return 0; }
  static get RECOGNITION_LEVEL_ACCURATE() { return 1; }

  /**
   * Perform OCR text recognition
   * @param {string} imagePath - Image file path
   * @param {Object} [options] - OCR options
   * @param {string} [options.languages='en-US'] - Recognition language, multiple languages separated by commas
   * @param {number} [options.recognitionLevel=MacOCR.RECOGNITION_LEVEL_ACCURATE] - Recognition level: MacOCR.RECOGNITION_LEVEL_FAST or MacOCR.RECOGNITION_LEVEL_ACCURATE
   * @param {number} [options.minConfidence=0.0] - Minimum confidence threshold 0.0-1.0
   * @param {string} [options.outputPath] - Output file path, if specified, the result will be saved to the file
   * @returns {Promise<{text: string, confidence: number}>} Recognition result
   */
  static async recognize(imagePath, options = {}) {
    // Validate input
    if (typeof imagePath !== 'string') {
      throw new TypeError('Image path must be a string');
    }

    // Validate if the file exists
    if (!fs.existsSync(imagePath)) {
      throw new Error('Image file does not exist');
    }

    // Validate file extension
    const ext = path.extname(imagePath).toLowerCase();
    const validExts = ['.jpg', '.jpeg', '.png', '.tiff', '.tif', '.gif', '.bmp', 'webp'];
    if (!validExts.includes(ext)) {
      throw new Error(`Unsupported image format: ${ext}`);
    }

    // Validate and normalize options
    const normalizedOptions = {
      languages: options.languages || 'en-US',
      recognitionLevel: options.recognitionLevel ?? MacOCR.RECOGNITION_LEVEL_ACCURATE,
      minConfidence: options.minConfidence || 0.0,
      outputPath: options.outputPath || null
    };

    if (![MacOCR.RECOGNITION_LEVEL_FAST, MacOCR.RECOGNITION_LEVEL_ACCURATE].includes(normalizedOptions.recognitionLevel)) {
      throw new Error('Recognition level must be MacOCR.RECOGNITION_LEVEL_FAST or MacOCR.RECOGNITION_LEVEL_ACCURATE');
    }

    if (normalizedOptions.minConfidence < 0 || normalizedOptions.minConfidence > 1) {
      throw new Error('Minimum confidence must be between 0.0 and 1.0');
    }

    // Validate output path
    if (normalizedOptions.outputPath) {
      const outputDir = path.dirname(normalizedOptions.outputPath);
      if (!fs.existsSync(outputDir)) {
        throw new Error('Output directory does not exist');
      }
      if (!fs.accessSync(outputDir, fs.constants.W_OK)) {
        throw new Error('Output directory is not writable');
      }
    }

    try {
      // Call native module
      return await recognize(imagePath, normalizedOptions);
    } catch (error) {
      throw new Error(`OCR failed: ${error.message}`);
    }
  }

  /**
   * Batch OCR text recognition
   * @param {string[]} imagePaths - Image file path array
   * @param {Object} [options] - Batch processing options
   * @param {Object} [options.ocrOptions] - OCR options
   * @param {string} [options.ocrOptions.languages='en-US'] - Recognition language, multiple languages separated by commas
   * @param {number} [options.ocrOptions.recognitionLevel=MacOCR.RECOGNITION_LEVEL_ACCURATE] - Recognition level
   * @param {number} [options.ocrOptions.minConfidence=0.0] - Minimum confidence threshold 0.0-1.0
   * @param {number} [options.maxThreads=0] - Maximum number of threads, 0 means using system CPU cores
   * @param {number} [options.batchSize=1] - Batch size
   * @returns {Promise<Array<{text: string, confidence: number}>>} Recognition result array
   */
  static async recognizeBatch(imagePaths, options = {}) {
    // Validate input
    if (!Array.isArray(imagePaths)) {
      throw new TypeError('Image paths must be an array');
    }

    if (imagePaths.length === 0) {
      throw new Error('Image paths array cannot be empty');
    }

    // Validate all image paths
    for (const imagePath of imagePaths) {
      if (typeof imagePath !== 'string') {
        throw new TypeError('Each image path must be a string');
      }

      if (!fs.existsSync(imagePath)) {
        throw new Error(`Image file does not exist: ${imagePath}`);
      }

      const ext = path.extname(imagePath).toLowerCase();
      const validExts = ['.jpg', '.jpeg', '.png', '.tiff', '.tif', '.gif', '.bmp', '.webp'];
      if (!validExts.includes(ext)) {
        throw new Error(`Unsupported image format: ${ext}`);
      }
    }

    // Normalize options
    const normalizedOptions = {
      ocrOptions: {
        languages: options.ocrOptions?.languages || 'en-US',
        recognitionLevel: options.ocrOptions?.recognitionLevel ?? MacOCR.RECOGNITION_LEVEL_ACCURATE,
        minConfidence: options.ocrOptions?.minConfidence || 0.0
      },
      maxThreads: options.maxThreads || 0,
      batchSize: options.batchSize || 1
    };

    // Validate OCR options
    if (![MacOCR.RECOGNITION_LEVEL_FAST, MacOCR.RECOGNITION_LEVEL_ACCURATE]
        .includes(normalizedOptions.ocrOptions.recognitionLevel)) {
      throw new Error('Recognition level must be MacOCR.RECOGNITION_LEVEL_FAST or MacOCR.RECOGNITION_LEVEL_ACCURATE');
    }

    if (normalizedOptions.ocrOptions.minConfidence < 0 || normalizedOptions.ocrOptions.minConfidence > 1) {
      throw new Error('Minimum confidence must be between 0.0 and 1.0');
    }

    // Validate batch processing options
    if (normalizedOptions.maxThreads < 0) {
      throw new Error('Maximum threads must be greater than or equal to 0');
    }

    if (normalizedOptions.batchSize < 1) {
      throw new Error('Batch size must be greater than 0');
    }

    try {
      // Call native module's batch method
      const results = await recognizeBatch(imagePaths, normalizedOptions);
      return results;
    } catch (error) {
      throw new Error(`Batch OCR failed: ${error.message}`);
    }
  }
}

module.exports = MacOCR; 