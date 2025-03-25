const MacOCR = require('../src/index');
const path = require('path');
const fs = require('fs');
const { Buffer } = require('buffer');
const { createTestImage } = require('./createTestImage');
const { v4: uuidv4 } = require('uuid');

describe('MacOCR', () => {
  let testImagePath;
  let fixturesDir;
  
  beforeAll(async () => {
    fixturesDir = path.join(__dirname, 'fixtures');
    try {
      await fs.promises.mkdir(fixturesDir, { recursive: true });
    } catch (error) {
      console.error('Error creating fixtures directory:', error);
    }
  });

  beforeEach(async () => {
    if (!fs.existsSync(fixturesDir)) {
      await fs.promises.mkdir(fixturesDir, { recursive: true });
    }
    const uniqueName = `macocr-test-${uuidv4()}.png`;
    testImagePath = await createTestImage('MacOCR test', uniqueName);
    
    if (!fs.existsSync(testImagePath)) {
      throw new Error(`Test image was not created at ${testImagePath}`);
    }
  });

  afterEach(async () => {
    try {
      if (testImagePath && fs.existsSync(testImagePath)) {
        await fs.promises.unlink(testImagePath);
      }
    } catch (error) {
      console.error('Error cleaning up test image:', error);
    }
  });

  afterAll(async () => {
    try {
      if (fs.existsSync(fixturesDir)) {
        const files = await fs.promises.readdir(fixturesDir);
        if (files.length === 0) {
          await fs.promises.rmdir(fixturesDir);
        }
      }
    } catch (error) {
      console.error('Error cleaning up fixtures directory:', error);
    }
  });

  describe('Static Properties', () => {
    test('should have RECOGNITION_LEVEL_FAST constant', () => {
      expect(MacOCR.RECOGNITION_LEVEL_FAST).toBe(0);
    });

    test('should have RECOGNITION_LEVEL_ACCURATE constant', () => {
      expect(MacOCR.RECOGNITION_LEVEL_ACCURATE).toBe(1);
    });
  });

  describe('recognize()', () => {
    test('should throw TypeError for non-string image path', async () => {
      await expect(MacOCR.recognizeFromPath(123)).rejects.toThrow(TypeError);
      await expect(MacOCR.recognizeFromPath(null)).rejects.toThrow(TypeError);
      await expect(MacOCR.recognizeFromPath(undefined)).rejects.toThrow(TypeError);
    });

    test('should throw Error for non-existent image file', async () => {
      await expect(MacOCR.recognizeFromPath('nonexistent.jpg')).rejects.toThrow('Image file does not exist');
    });

    test('should throw Error for unsupported image format', async () => {
      const badFileName = path.join(fixturesDir, `bad-format-${uuidv4()}.xyz`);
      await fs.promises.writeFile(badFileName, 'dummy content');
      await expect(MacOCR.recognizeFromPath(badFileName)).rejects.toThrow('Unsupported image format');
      await fs.promises.unlink(badFileName);
    });

    test('should throw Error for invalid recognition level', async () => {
      expect(fs.existsSync(testImagePath)).toBe(true);
      await expect(MacOCR.recognizeFromPath(testImagePath, { recognitionLevel: 999 }))
        .rejects.toThrow('Recognition level must be MacOCR.RECOGNITION_LEVEL_FAST or MacOCR.RECOGNITION_LEVEL_ACCURATE');
    });

    test('should throw Error for invalid confidence threshold', async () => {
      expect(fs.existsSync(testImagePath)).toBe(true);
      await expect(MacOCR.recognizeFromPath(testImagePath, { minConfidence: -1 }))
        .rejects.toThrow('Minimum confidence must be between 0.0 and 1.0');
      await expect(MacOCR.recognizeFromPath(testImagePath, { minConfidence: 1.5 }))
        .rejects.toThrow('Minimum confidence must be between 0.0 and 1.0');
    });

    test('should perform OCR with default options', async () => {
      expect(fs.existsSync(testImagePath)).toBe(true);
      const result = await MacOCR.recognizeFromPath(testImagePath);
      expect(result).toHaveProperty('text');
      expect(result).toHaveProperty('confidence');
      expect(typeof result.text).toBe('string');
      expect(typeof result.confidence).toBe('number');
      expect(result.confidence).toBeGreaterThanOrEqual(0);
      expect(result.confidence).toBeLessThanOrEqual(1);
    });

    test('should perform OCR with custom options', async () => {
      expect(fs.existsSync(testImagePath)).toBe(true);
      const options = {
        languages: 'en-US',
        recognitionLevel: MacOCR.RECOGNITION_LEVEL_ACCURATE,
        minConfidence: 0.5
      };
      const result = await MacOCR.recognizeFromPath(testImagePath, options);
      expect(result).toHaveProperty('text');
      expect(result).toHaveProperty('confidence');
      expect(result.confidence).toBeGreaterThanOrEqual(0.5);
    });
  });

  describe('recognizeBatch()', () => {
    let testImagePaths = [];
    
    beforeEach(async () => {
      // Create multiple test images
      const imageCount = 3;
      for (let i = 0; i < imageCount; i++) {
        const uniqueName = `macocr-batch-test-${uuidv4()}.png`;
        const imagePath = await createTestImage(`MacOCR batch test ${i + 1}`, uniqueName);
        testImagePaths.push(imagePath);
      }
    });

    afterEach(async () => {
      // Clean up test images
      for (const imagePath of testImagePaths) {
        try {
          if (fs.existsSync(imagePath)) {
            await fs.promises.unlink(imagePath);
          }
        } catch (error) {
          console.error('Error cleaning up test image:', error);
        }
      }
      testImagePaths = [];
    });

    test('should throw TypeError for non-array image paths', async () => {
      await expect(MacOCR.recognizeBatchFromPath('not-an-array')).rejects.toThrow(TypeError);
      await expect(MacOCR.recognizeBatchFromPath(123)).rejects.toThrow(TypeError);
      await expect(MacOCR.recognizeBatchFromPath(null)).rejects.toThrow(TypeError);
      await expect(MacOCR.recognizeBatchFromPath(undefined)).rejects.toThrow(TypeError);
    });

    test('should throw Error for empty array of image paths', async () => {
      await expect(MacOCR.recognizeBatchFromPath([])).rejects.toThrow('Image paths array cannot be empty');
    });

    test('should throw Error if any image in batch does not exist', async () => {
      const paths = [...testImagePaths, 'nonexistent.jpg'];
      await expect(MacOCR.recognizeBatchFromPath(paths)).rejects.toThrow();
    });

    test('should perform batch OCR with default options', async () => {
      
      const results = await MacOCR.recognizeBatchFromPath(testImagePaths);
      
      
      expect(Array.isArray(results)).toBe(true);
      if (!Array.isArray(results)) {
        console.error('results is not an array', results);
      }
      
      expect(results.length).toBe(testImagePaths.length);
      
      for (let i = 0; i < results.length; i++) {
        expect(results[i]).toHaveProperty('text');
        expect(results[i]).toHaveProperty('confidence');
        expect(typeof results[i].text).toBe('string');
        expect(typeof results[i].confidence).toBe('number');
        expect(results[i].confidence).toBeGreaterThanOrEqual(0);
        expect(results[i].confidence).toBeLessThanOrEqual(1);
        expect(results[i].text.toLowerCase()).toContain(`batch test ${i + 1}`);
      }
    });

    test('should perform batch OCR with custom options', async () => {
      const options = {
        ocrOptions: {
          languages: 'en-US',
          recognitionLevel: MacOCR.RECOGNITION_LEVEL_ACCURATE,
          minConfidence: 0.5
        },
        maxThreads: 2,
        batchSize: 2
      };

      const results = await MacOCR.recognizeBatchFromPath(testImagePaths, options);
      expect(Array.isArray(results)).toBe(true);
      expect(results.length).toBe(testImagePaths.length);

      for (const result of results) {
        expect(result).toHaveProperty('text');
        expect(result).toHaveProperty('confidence');
        expect(result.confidence).toBeGreaterThanOrEqual(0.5);
      }
    });

    test('should handle invalid batch options', async () => {
      const invalidOptions = {
        maxThreads: -1,
        batchSize: 0
      };
      await expect(MacOCR.recognizeBatchFromPath(testImagePaths, invalidOptions))
        .rejects.toThrow();
    });

    test('should process large batches efficiently', async () => {
      const largeImageCount = 10;
      const largeBatchPaths = [];

      // Create more test images
      for (let i = 0; i < largeImageCount; i++) {
        const uniqueName = `macocr-large-batch-${uuidv4()}.png`;
        const imagePath = await createTestImage(`Large batch test ${i + 1}`, uniqueName);
        largeBatchPaths.push(imagePath);
      }

      try {
        const options = {
          maxThreads: 4,
          batchSize: 3
        };

        const results = await MacOCR.recognizeBatchFromPath(largeBatchPaths, options);
        expect(Array.isArray(results)).toBe(true);
        expect(results.length).toBe(largeImageCount);

        for (let i = 0; i < results.length; i++) {
          expect(results[i]).toHaveProperty('text');
          expect(results[i]).toHaveProperty('confidence');
          expect(results[i].text.toLowerCase()).toContain(`large batch test ${i + 1}`);
        }
      } finally {
        // Clean up additional test images
        for (const imagePath of largeBatchPaths) {
          try {
            if (fs.existsSync(imagePath)) {
              await fs.promises.unlink(imagePath);
            }
          } catch (error) {
            console.error('Error cleaning up large batch test image:', error);
          }
        }
      }
    });
  });

  describe('recognizeBuffer()', () => {
    let testImageBuffer;
    
    beforeEach(async () => {
      const uniqueName = `macocr-buffer-test-${uuidv4()}.png`;
      const imagePath = await createTestImage('MacOCR buffer test', uniqueName);
      testImageBuffer = await fs.promises.readFile(imagePath);
      await fs.promises.unlink(imagePath); // Immediately delete the file after reading it
    });

    test('should throw TypeError for invalid input types', async () => {
      await expect(MacOCR.recognizeFromBuffer(null)).rejects.toThrow(TypeError);
      await expect(MacOCR.recognizeFromBuffer(undefined)).rejects.toThrow(TypeError);
      await expect(MacOCR.recognizeFromBuffer({})).rejects.toThrow(TypeError);
      await expect(MacOCR.recognizeFromBuffer('not-a-buffer')).rejects.toThrow(TypeError);
      await expect(MacOCR.recognizeFromBuffer(123)).rejects.toThrow(TypeError);
    });

    test('should accept Uint8Array as input', async () => {
      // Convert Buffer to Uint8Array
      const uint8Array = new Uint8Array(testImageBuffer);
      const result = await MacOCR.recognizeFromBuffer(uint8Array);
      
      expect(result).toHaveProperty('text');
      expect(result).toHaveProperty('confidence');
      expect(typeof result.text).toBe('string');
      expect(typeof result.confidence).toBe('number');
      expect(result.confidence).toBeGreaterThanOrEqual(0);
      expect(result.confidence).toBeLessThanOrEqual(1);
      expect(result.text.toLowerCase()).toContain('buffer test');
    });

    test('should throw Error for invalid image data', async () => {
      await expect(MacOCR.recognizeFromBuffer(Buffer.alloc(10))).rejects.toThrow(Error);
      await expect(MacOCR.recognizeFromBuffer(new Uint8Array(10))).rejects.toThrow(Error);
    });

    test('should throw Error for empty buffer', async () => {
      await expect(MacOCR.recognizeFromBuffer(Buffer.alloc(0))).rejects.toThrow('Image buffer cannot be empty');
    });

    test('should throw Error for invalid recognition level', async () => {
      await expect(MacOCR.recognizeFromBuffer(testImageBuffer, { recognitionLevel: 999 }))
        .rejects.toThrow('Recognition level must be MacOCR.RECOGNITION_LEVEL_FAST or MacOCR.RECOGNITION_LEVEL_ACCURATE');
    });

    test('should throw Error for invalid confidence threshold', async () => {
      await expect(MacOCR.recognizeFromBuffer(testImageBuffer, { minConfidence: -1 }))
        .rejects.toThrow('Minimum confidence must be between 0.0 and 1.0');
      await expect(MacOCR.recognizeFromBuffer(testImageBuffer, { minConfidence: 1.5 }))
        .rejects.toThrow('Minimum confidence must be between 0.0 and 1.0');
    });

    test('should perform OCR with default options', async () => {
      const result = await MacOCR.recognizeFromBuffer(testImageBuffer);
      expect(result).toHaveProperty('text');
      expect(result).toHaveProperty('confidence');
      expect(typeof result.text).toBe('string');
      expect(typeof result.confidence).toBe('number');
      expect(result.confidence).toBeGreaterThanOrEqual(0);
      expect(result.confidence).toBeLessThanOrEqual(1);
      expect(result.text.toLowerCase()).toContain('buffer test');
    });

    test('should perform OCR with custom options', async () => {
      const options = {
        languages: 'en-US',
        recognitionLevel: MacOCR.RECOGNITION_LEVEL_ACCURATE,
        minConfidence: 0.5
      };
      const result = await MacOCR.recognizeFromBuffer(testImageBuffer, options);
      expect(result).toHaveProperty('text');
      expect(result).toHaveProperty('confidence');
      expect(result.confidence).toBeGreaterThanOrEqual(0.5);
      expect(result.text.toLowerCase()).toContain('buffer test');
    });

    test('should handle various image formats in buffer', async () => {
      const formats = [
        { ext: 'jpg', mime: 'image/jpeg' },
        { ext: 'png', mime: 'image/png' },
        { ext: 'gif', mime: 'image/gif' }
      ];

      for (const format of formats) {
        const uniqueName = `macocr-buffer-test-${uuidv4()}.${format.ext}`;
        const imagePath = await createTestImage(`MacOCR ${format.ext} test`, uniqueName);
        const imageBuffer = await fs.promises.readFile(imagePath);
        await fs.promises.unlink(imagePath);

        const result = await MacOCR.recognizeFromBuffer(imageBuffer);
        expect(result).toHaveProperty('text');
        expect(result).toHaveProperty('confidence');
        expect(typeof result.text).toBe('string');
        expect(result.text.toLowerCase()).toContain(`${format.ext} test`);
      }
    });

    test('should handle large image buffers', async () => {
      const uniqueName = `macocr-large-buffer-test-${uuidv4()}.png`;
      const imagePath = await createTestImage('MacOCR large buffer test', uniqueName, { 
        width: 1024, 
        height: 768,
        fontSize: 48
      });
      const largeBuffer = await fs.promises.readFile(imagePath);
      await fs.promises.unlink(imagePath);

      const result = await MacOCR.recognizeFromBuffer(largeBuffer, {
        recognitionLevel: MacOCR.RECOGNITION_LEVEL_ACCURATE,  
        minConfidence: 0.0
      });
      expect(result).toHaveProperty('text');
      expect(result).toHaveProperty('confidence');
      expect(result.text.toLowerCase()).toContain('large buffer test');
    });
  });
}); 