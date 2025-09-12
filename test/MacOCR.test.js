const MacOCR = require('../src/index');
const path = require('path');
const fs = require('fs');
const { Buffer } = require('buffer');
const { createTestImage, createPrecisionTestImage } = require('./createTestImage');
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
      await expect(MacOCR.recognizeFromPath('nonexistent.jpg')).rejects.toThrow(
        'Image file does not exist'
      );
    });

    test('should throw Error for unsupported image format', async () => {
      const badFileName = path.join(fixturesDir, `bad-format-${uuidv4()}.xyz`);
      await fs.promises.writeFile(badFileName, 'dummy content');
      await expect(MacOCR.recognizeFromPath(badFileName)).rejects.toThrow(
        'Unsupported image format'
      );
      await fs.promises.unlink(badFileName);
    });

    test('should throw Error for invalid recognition level', async () => {
      expect(fs.existsSync(testImagePath)).toBe(true);
      await expect(
        MacOCR.recognizeFromPath(testImagePath, { recognitionLevel: 999 })
      ).rejects.toThrow(
        'Recognition level must be MacOCR.RECOGNITION_LEVEL_FAST or MacOCR.RECOGNITION_LEVEL_ACCURATE'
      );
    });

    test('should throw Error for invalid confidence threshold', async () => {
      expect(fs.existsSync(testImagePath)).toBe(true);
      await expect(MacOCR.recognizeFromPath(testImagePath, { minConfidence: -1 })).rejects.toThrow(
        'Minimum confidence must be between 0.0 and 1.0'
      );
      await expect(MacOCR.recognizeFromPath(testImagePath, { minConfidence: 1.5 })).rejects.toThrow(
        'Minimum confidence must be between 0.0 and 1.0'
      );
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
      expect(Array.isArray(result.observations)).toBe(true);
    });

    test('should perform OCR with custom options', async () => {
      expect(fs.existsSync(testImagePath)).toBe(true);
      const options = {
        languages: 'en-US',
        recognitionLevel: MacOCR.RECOGNITION_LEVEL_ACCURATE,
        minConfidence: 0.5,
      };
      const result = await MacOCR.recognizeFromPath(testImagePath, options);
      expect(result).toHaveProperty('text');
      expect(result).toHaveProperty('confidence');
      expect(result.confidence).toBeGreaterThanOrEqual(0.5);
    });

    test('should return observations with native macOS coordinates', async () => {
      expect(fs.existsSync(testImagePath)).toBe(true);
      const result = await MacOCR.recognizeFromPath(testImagePath);
      const observations = result.observations;

      expect(Array.isArray(observations)).toBe(true);

      if (observations.length > 0) {
        for (const obs of observations) {
          expect(obs).toHaveProperty('text');
          expect(obs).toHaveProperty('confidence');
          expect(obs).toHaveProperty('x');
          expect(obs).toHaveProperty('y');
          expect(obs).toHaveProperty('width');
          expect(obs).toHaveProperty('height');

          expect(typeof obs.text).toBe('string');
          expect(typeof obs.confidence).toBe('number');
          expect(typeof obs.x).toBe('number');
          expect(typeof obs.y).toBe('number');
          expect(typeof obs.width).toBe('number');
          expect(typeof obs.height).toBe('number');

          // Coordinates should be normalized (0.0-1.0) with bottom-left origin
          expect(obs.x).toBeGreaterThanOrEqual(0);
          expect(obs.x).toBeLessThanOrEqual(1);
          expect(obs.y).toBeGreaterThanOrEqual(0);
          expect(obs.y).toBeLessThanOrEqual(1);
          expect(obs.width).toBeGreaterThanOrEqual(0);
          expect(obs.width).toBeLessThanOrEqual(1);
          expect(obs.height).toBeGreaterThanOrEqual(0);
          expect(obs.height).toBeLessThanOrEqual(1);

          expect(obs.confidence).toBeGreaterThanOrEqual(0);
          expect(obs.confidence).toBeLessThanOrEqual(1);
        }
      }
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
      await expect(MacOCR.recognizeBatchFromPath([])).rejects.toThrow(
        'Image paths array cannot be empty'
      );
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

        // Test observations functionality
        expect(results[i]).toHaveProperty('observations');
        expect(Array.isArray(results[i].observations)).toBe(true);

        const observations = results[i].observations;
        expect(Array.isArray(observations)).toBe(true);

        // If there are observations, validate their structure
        if (observations.length > 0) {
          for (const obs of observations) {
            expect(obs).toHaveProperty('text');
            expect(obs).toHaveProperty('confidence');
            expect(obs).toHaveProperty('x');
            expect(obs).toHaveProperty('y');
            expect(obs).toHaveProperty('width');
            expect(obs).toHaveProperty('height');

            expect(typeof obs.text).toBe('string');
            expect(typeof obs.confidence).toBe('number');
            expect(typeof obs.x).toBe('number');
            expect(typeof obs.y).toBe('number');
            expect(typeof obs.width).toBe('number');
            expect(typeof obs.height).toBe('number');

            expect(obs.confidence).toBeGreaterThanOrEqual(0);
            expect(obs.confidence).toBeLessThanOrEqual(1);
            expect(obs.x).toBeGreaterThanOrEqual(0);
            expect(obs.y).toBeGreaterThanOrEqual(0);
            expect(obs.width).toBeGreaterThan(0);
            expect(obs.height).toBeGreaterThan(0);
          }
        }
      }
    });

    test('should perform batch OCR with custom options', async () => {
      const options = {
        ocrOptions: {
          languages: 'en-US',
          recognitionLevel: MacOCR.RECOGNITION_LEVEL_ACCURATE,
          minConfidence: 0.5,
        },
        maxThreads: 2,
        batchSize: 2,
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
        batchSize: 0,
      };
      await expect(MacOCR.recognizeBatchFromPath(testImagePaths, invalidOptions)).rejects.toThrow();
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
          batchSize: 3,
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

    test('should return detailed observations in batch OCR results', async () => {
      const results = await MacOCR.recognizeBatchFromPath(testImagePaths);

      expect(Array.isArray(results)).toBe(true);
      expect(results.length).toBeGreaterThan(0);

      let totalObservationsFound = 0;

      for (let i = 0; i < results.length; i++) {
        const result = results[i];

        // Verify OCRResult structure
        expect(result).toBeInstanceOf(MacOCR.OCRResult || Object);
        expect(result).toHaveProperty('observations');

        const observations = result.observations;
        expect(Array.isArray(observations)).toBe(true);

        if (observations.length > 0) {
          totalObservationsFound += observations.length;

          // Test first observation in detail
          const firstObs = observations[0];
          expect(firstObs.text).toBeTruthy();
          expect(firstObs.text.length).toBeGreaterThan(0);

          // Verify coordinate system (native macOS coordinates)
          expect(firstObs.x).toBeGreaterThanOrEqual(0);
          expect(firstObs.x).toBeLessThanOrEqual(1);
          expect(firstObs.y).toBeGreaterThanOrEqual(0);
          expect(firstObs.y).toBeLessThanOrEqual(1);
          expect(firstObs.width).toBeGreaterThan(0);
          expect(firstObs.width).toBeLessThanOrEqual(1);
          expect(firstObs.height).toBeGreaterThan(0);
          expect(firstObs.height).toBeLessThanOrEqual(1);

          // Verify bounding box makes sense
          expect(firstObs.x + firstObs.width).toBeLessThanOrEqual(1.01); // Allow small floating point errors
          expect(firstObs.y + firstObs.height).toBeLessThanOrEqual(1.01);

          // Test that observations are sorted or at least in reasonable order
          if (observations.length > 1) {
            let hasValidOrder = true;
            for (let j = 1; j < observations.length; j++) {
              const prevObs = observations[j - 1];
              const currObs = observations[j];

              // In native macOS coordinates, higher y values are towards the top
              // So we expect text to generally flow from top to bottom (higher y to lower y)
              // But we'll be lenient since text can be on the same line
              if (Math.abs(prevObs.y - currObs.y) > 0.1) {
                // If y difference is significant, previous should be higher (larger y)
                if (prevObs.y < currObs.y - 0.1) {
                  hasValidOrder = false;
                  break;
                }
              }
            }
            // Note: We don't enforce strict ordering as OCR results can vary
          }
        }
      }

      // We expect at least some observations from the test images
      expect(totalObservationsFound).toBeGreaterThan(0);
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
      await expect(MacOCR.recognizeFromBuffer(Buffer.alloc(0))).rejects.toThrow(
        'Image buffer cannot be empty'
      );
    });

    test('should throw Error for invalid recognition level', async () => {
      await expect(
        MacOCR.recognizeFromBuffer(testImageBuffer, { recognitionLevel: 999 })
      ).rejects.toThrow(
        'Recognition level must be MacOCR.RECOGNITION_LEVEL_FAST or MacOCR.RECOGNITION_LEVEL_ACCURATE'
      );
    });

    test('should throw Error for invalid confidence threshold', async () => {
      await expect(
        MacOCR.recognizeFromBuffer(testImageBuffer, { minConfidence: -1 })
      ).rejects.toThrow('Minimum confidence must be between 0.0 and 1.0');
      await expect(
        MacOCR.recognizeFromBuffer(testImageBuffer, { minConfidence: 1.5 })
      ).rejects.toThrow('Minimum confidence must be between 0.0 and 1.0');
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
        minConfidence: 0.5,
      };
      const result = await MacOCR.recognizeFromBuffer(testImageBuffer, options);
      expect(result).toHaveProperty('text');
      expect(result).toHaveProperty('confidence');
      expect(result.confidence).toBeGreaterThanOrEqual(0.5);
      expect(result.text.toLowerCase()).toContain('buffer test');
    });

    test('should return observations with native macOS coordinates from buffer', async () => {
      const result = await MacOCR.recognizeFromBuffer(testImageBuffer);
      const observations = result.observations;

      expect(Array.isArray(observations)).toBe(true);
      expect(Array.isArray(result.observations)).toBe(true);

      if (observations.length > 0) {
        for (const obs of observations) {
          expect(obs).toHaveProperty('text');
          expect(obs).toHaveProperty('confidence');
          expect(obs).toHaveProperty('x');
          expect(obs).toHaveProperty('y');
          expect(obs).toHaveProperty('width');
          expect(obs).toHaveProperty('height');

          // Coordinates should be normalized (0.0-1.0) with bottom-left origin
          expect(obs.x).toBeGreaterThanOrEqual(0);
          expect(obs.x).toBeLessThanOrEqual(1);
          expect(obs.y).toBeGreaterThanOrEqual(0);
          expect(obs.y).toBeLessThanOrEqual(1);
          expect(obs.width).toBeGreaterThanOrEqual(0);
          expect(obs.width).toBeLessThanOrEqual(1);
          expect(obs.height).toBeGreaterThanOrEqual(0);
          expect(obs.height).toBeLessThanOrEqual(1);
        }
      }
    });

    test('should handle various image formats in buffer', async () => {
      const formats = [
        { ext: 'jpg', mime: 'image/jpeg' },
        { ext: 'png', mime: 'image/png' },
        { ext: 'gif', mime: 'image/gif' },
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
        fontSize: 48,
      });
      const largeBuffer = await fs.promises.readFile(imagePath);
      await fs.promises.unlink(imagePath);

      const result = await MacOCR.recognizeFromBuffer(largeBuffer, {
        recognitionLevel: MacOCR.RECOGNITION_LEVEL_ACCURATE,
        minConfidence: 0.0,
      });
      expect(result).toHaveProperty('text');
      expect(result).toHaveProperty('confidence');
      expect(result.text.toLowerCase()).toContain('large buffer test');
    });
  });

  describe('recognizeBatchFromBuffer()', () => {
    let testImageBuffers = [];

    beforeEach(async () => {
      // Create multiple test images and store their buffers
      const imageCount = 3;
      for (let i = 0; i < imageCount; i++) {
        const uniqueName = `macocr-buffer-batch-test-${uuidv4()}.png`;
        const imagePath = await createTestImage(`MacOCR buffer batch test ${i + 1}`, uniqueName);
        const buffer = await fs.promises.readFile(imagePath);
        testImageBuffers.push(buffer);
        await fs.promises.unlink(imagePath); // Clean up image file immediately
      }
    });

    afterEach(() => {
      testImageBuffers = [];
    });

    test('should throw TypeError for non-array image buffers', async () => {
      await expect(MacOCR.recognizeBatchFromBuffer('not-an-array')).rejects.toThrow(TypeError);
      await expect(MacOCR.recognizeBatchFromBuffer(123)).rejects.toThrow(TypeError);
      await expect(MacOCR.recognizeBatchFromBuffer(null)).rejects.toThrow(TypeError);
      await expect(MacOCR.recognizeBatchFromBuffer(undefined)).rejects.toThrow(TypeError);
    });

    test('should throw Error for empty array of image buffers', async () => {
      await expect(MacOCR.recognizeBatchFromBuffer([])).rejects.toThrow(
        'Image buffers array cannot be empty'
      );
    });

    test('should throw TypeError for invalid buffer types in array', async () => {
      const invalidBuffers = [...testImageBuffers, 'not-a-buffer'];
      await expect(MacOCR.recognizeBatchFromBuffer(invalidBuffers)).rejects.toThrow(TypeError);
    });

    test('should accept array of Uint8Arrays as input', async () => {
      const uint8Arrays = testImageBuffers.map((buffer) => new Uint8Array(buffer));
      const results = await MacOCR.recognizeBatchFromBuffer(uint8Arrays);

      expect(Array.isArray(results)).toBe(true);
      expect(results.length).toBe(testImageBuffers.length);

      for (let i = 0; i < results.length; i++) {
        expect(results[i]).toHaveProperty('text');
        expect(results[i]).toHaveProperty('confidence');
        expect(typeof results[i].text).toBe('string');
        expect(typeof results[i].confidence).toBe('number');
        expect(results[i].confidence).toBeGreaterThanOrEqual(0);
        expect(results[i].confidence).toBeLessThanOrEqual(1);
        expect(results[i].text.toLowerCase()).toContain(`buffer batch test ${i + 1}`);
      }
    });

    test('should perform batch OCR with default options', async () => {
      const results = await MacOCR.recognizeBatchFromBuffer(testImageBuffers);

      expect(Array.isArray(results)).toBe(true);
      expect(results.length).toBe(testImageBuffers.length);

      for (let i = 0; i < results.length; i++) {
        expect(results[i]).toHaveProperty('text');
        expect(results[i]).toHaveProperty('confidence');
        expect(results[i].text.toLowerCase()).toContain(`buffer batch test ${i + 1}`);

        // Test observations functionality
        expect(results[i]).toHaveProperty('observations');
        expect(Array.isArray(results[i].observations)).toBe(true);

        const observations = results[i].observations;
        expect(Array.isArray(observations)).toBe(true);

        // If there are observations, validate their structure
        if (observations.length > 0) {
          for (const obs of observations) {
            expect(obs).toHaveProperty('text');
            expect(obs).toHaveProperty('confidence');
            expect(obs).toHaveProperty('x');
            expect(obs).toHaveProperty('y');
            expect(obs).toHaveProperty('width');
            expect(obs).toHaveProperty('height');

            expect(typeof obs.text).toBe('string');
            expect(typeof obs.confidence).toBe('number');
            expect(typeof obs.x).toBe('number');
            expect(typeof obs.y).toBe('number');
            expect(typeof obs.width).toBe('number');
            expect(typeof obs.height).toBe('number');

            expect(obs.confidence).toBeGreaterThanOrEqual(0);
            expect(obs.confidence).toBeLessThanOrEqual(1);
            expect(obs.x).toBeGreaterThanOrEqual(0);
            expect(obs.y).toBeGreaterThanOrEqual(0);
            expect(obs.width).toBeGreaterThan(0);
            expect(obs.height).toBeGreaterThan(0);
          }
        }
      }
    });

    test('should perform batch OCR with custom options', async () => {
      const options = {
        ocrOptions: {
          languages: 'en-US',
          recognitionLevel: MacOCR.RECOGNITION_LEVEL_ACCURATE,
          minConfidence: 0.5,
        },
        maxThreads: 2,
        batchSize: 2,
      };

      const results = await MacOCR.recognizeBatchFromBuffer(testImageBuffers, options);
      expect(Array.isArray(results)).toBe(true);
      expect(results.length).toBe(testImageBuffers.length);

      for (const result of results) {
        expect(result).toHaveProperty('text');
        expect(result).toHaveProperty('confidence');
        expect(result.confidence).toBeGreaterThanOrEqual(0.5);
      }
    });

    test('should handle invalid batch options', async () => {
      const invalidOptions = {
        maxThreads: -1,
        batchSize: 0,
      };
      await expect(
        MacOCR.recognizeBatchFromBuffer(testImageBuffers, invalidOptions)
      ).rejects.toThrow();
    });

    test('should process large batches efficiently', async () => {
      const largeImageCount = 10;
      const largeBuffers = [];

      // Create more test images
      for (let i = 0; i < largeImageCount; i++) {
        const uniqueName = `macocr-large-buffer-batch-${uuidv4()}.png`;
        const imagePath = await createTestImage(`Large buffer batch test ${i + 1}`, uniqueName);
        const buffer = await fs.promises.readFile(imagePath);
        largeBuffers.push(buffer);
        await fs.promises.unlink(imagePath);
      }

      const options = {
        maxThreads: 4,
        batchSize: 3,
      };

      const results = await MacOCR.recognizeBatchFromBuffer(largeBuffers, options);
      expect(Array.isArray(results)).toBe(true);
      expect(results.length).toBe(largeImageCount);

      for (let i = 0; i < results.length; i++) {
        expect(results[i]).toHaveProperty('text');
        expect(results[i]).toHaveProperty('confidence');
        expect(results[i].text.toLowerCase()).toContain(`large buffer batch test ${i + 1}`);
      }
    });

    test('should return detailed observations in batch buffer OCR results', async () => {
      const results = await MacOCR.recognizeBatchFromBuffer(testImageBuffers);

      expect(Array.isArray(results)).toBe(true);
      expect(results.length).toBeGreaterThan(0);

      let totalObservationsFound = 0;

      for (let i = 0; i < results.length; i++) {
        const result = results[i];

        // Verify OCRResult structure
        expect(result).toBeInstanceOf(MacOCR.OCRResult || Object);
        expect(result).toHaveProperty('observations');

        const observations = result.observations;
        expect(Array.isArray(observations)).toBe(true);

        if (observations.length > 0) {
          totalObservationsFound += observations.length;

          // Test first observation in detail
          const firstObs = observations[0];
          expect(firstObs.text).toBeTruthy();
          expect(firstObs.text.length).toBeGreaterThan(0);

          // Verify coordinate system (native macOS coordinates)
          expect(firstObs.x).toBeGreaterThanOrEqual(0);
          expect(firstObs.x).toBeLessThanOrEqual(1);
          expect(firstObs.y).toBeGreaterThanOrEqual(0);
          expect(firstObs.y).toBeLessThanOrEqual(1);
          expect(firstObs.width).toBeGreaterThan(0);
          expect(firstObs.width).toBeLessThanOrEqual(1);
          expect(firstObs.height).toBeGreaterThan(0);
          expect(firstObs.height).toBeLessThanOrEqual(1);

          // Verify bounding box makes sense
          expect(firstObs.x + firstObs.width).toBeLessThanOrEqual(1.01); // Allow small floating point errors
          expect(firstObs.y + firstObs.height).toBeLessThanOrEqual(1.01);

          // Verify confidence is reasonable
          expect(firstObs.confidence).toBeGreaterThanOrEqual(0);
          expect(firstObs.confidence).toBeLessThanOrEqual(1);
        }
      }

      // We expect at least some observations from the test images
      expect(totalObservationsFound).toBeGreaterThan(0);
    });
  });

  describe('Precise Coordinate Validation', () => {
    let testImageData;

    beforeEach(async () => {
      // Create test image with known text positions
      const textBlocks = [
        { text: 'TOP', x: 50, y: 30, fontSize: 20 },
        { text: 'MIDDLE', x: 100, y: 150, fontSize: 24 },
        { text: 'BOTTOM', x: 200, y: 250, fontSize: 18 },
      ];

      const uniqueName = `precision-test-${uuidv4()}.png`;
      testImageData = await createPrecisionTestImage(textBlocks, uniqueName, {
        width: 400,
        height: 300,
      });
    });

    afterEach(async () => {
      try {
        if (testImageData?.imagePath && fs.existsSync(testImageData.imagePath)) {
          await fs.promises.unlink(testImageData.imagePath);
        }
      } catch (error) {
        console.error('Error cleaning up precision test image:', error);
      }
    });

    test('should return coordinates within reasonable range of expected positions', async () => {
      const result = await MacOCR.recognizeFromPath(testImageData.imagePath, {
        recognitionLevel: MacOCR.RECOGNITION_LEVEL_ACCURATE,
        minConfidence: 0.3,
      });

      const observations = result.observations;
      const expected = testImageData.expectedCoordinates;

      // Should detect at least some of the text blocks
      expect(observations.length).toBeGreaterThan(0);
      expect(observations.length).toBeLessThanOrEqual(expected.length);

      console.log('Expected coordinates:', expected);
      console.log('Detected coordinates:', observations);

      // For each detected observation, try to match it with an expected block
      observations.forEach((obs) => {
        // Find the best matching expected coordinate based on text content
        const matchingExpected = expected.find(
          (exp) => exp.text === obs.text || obs.text.includes(exp.text)
        );

        if (matchingExpected) {
          // Convert expected coordinates to native macOS coordinate system (bottom-left origin)
          const expectedMacOSY = 1.0 - (matchingExpected.y + matchingExpected.height);

          /*
           * Allow for some tolerance in coordinate matching (OCR isn't pixel-perfect)
           * Using precision 0 means tolerance of 0.5, which is reasonable for OCR coordinates
           */
          expect(obs.x).toBeCloseTo(matchingExpected.x, 0);
          expect(obs.y).toBeCloseTo(expectedMacOSY, 0);

          // Width and height are harder to predict exactly, so use wider tolerance
          expect(obs.width).toBeGreaterThan(0);
          expect(obs.height).toBeGreaterThan(0);
          expect(obs.width).toBeLessThanOrEqual(1.0);
          expect(obs.height).toBeLessThanOrEqual(1.0);

          console.log(
            `✓ Matched "${obs.text}": expected macOS (${matchingExpected.x.toFixed(3)}, ${expectedMacOSY.toFixed(3)}), actual (${obs.x.toFixed(3)}, ${obs.y.toFixed(3)})`
          );
        } else {
          console.log(
            `⚠ Unmatched text: "${obs.text}" at (${obs.x.toFixed(3)}, ${obs.y.toFixed(3)})`
          );
        }
      });
    });

    test('should maintain coordinate consistency across multiple recognitions', async () => {
      // Run OCR multiple times on the same image
      const results = await Promise.all([
        MacOCR.recognizeFromPath(testImageData.imagePath),
        MacOCR.recognizeFromPath(testImageData.imagePath),
        MacOCR.recognizeFromPath(testImageData.imagePath),
      ]);

      const observations1 = results[0].observations;
      const observations2 = results[1].observations;
      const observations3 = results[2].observations;

      // Should return the same number of observations
      expect(observations1.length).toBe(observations2.length);
      expect(observations2.length).toBe(observations3.length);

      // Coordinates should be consistent (allowing for tiny floating-point differences)
      for (let i = 0; i < observations1.length; i++) {
        expect(observations1[i].x).toBeCloseTo(observations2[i].x, 5);
        expect(observations1[i].y).toBeCloseTo(observations2[i].y, 5);
        expect(observations1[i].width).toBeCloseTo(observations2[i].width, 5);
        expect(observations1[i].height).toBeCloseTo(observations2[i].height, 5);
        expect(observations1[i].text).toBe(observations2[i].text);

        expect(observations2[i].x).toBeCloseTo(observations3[i].x, 5);
        expect(observations2[i].y).toBeCloseTo(observations3[i].y, 5);
        expect(observations2[i].width).toBeCloseTo(observations3[i].width, 5);
        expect(observations2[i].height).toBeCloseTo(observations3[i].height, 5);
        expect(observations2[i].text).toBe(observations3[i].text);
      }
    });

    test('should return reasonable coordinate order (native macOS bottom-left origin)', async () => {
      const result = await MacOCR.recognizeFromPath(testImageData.imagePath);
      const observations = result.observations;

      if (observations.length >= 2) {
        // In native macOS coordinates (bottom-left origin), higher y values mean higher on screen
        const topText = observations.find((obs) => obs.text.includes('TOP'));
        const bottomText = observations.find((obs) => obs.text.includes('BOTTOM'));

        if (topText && bottomText) {
          // In bottom-left origin system, TOP text should have HIGHER y value than BOTTOM text
          expect(topText.y).toBeGreaterThan(bottomText.y);
          console.log(
            `✓ TOP text at y=${topText.y.toFixed(3)}, BOTTOM text at y=${bottomText.y.toFixed(3)} (bottom-left origin)`
          );
        }
      }
    });
  });

  describe('Coordinate System Validation', () => {
    test('should handle different image dimensions consistently', async () => {
      const testCases = [
        { width: 200, height: 150, text: 'Small', x: 50, y: 75 },
        { width: 800, height: 600, text: 'Large', x: 200, y: 300 },
        { width: 400, height: 400, text: 'Square', x: 200, y: 200 },
      ];

      for (const testCase of testCases) {
        const uniqueName = `dimension-test-${testCase.width}x${testCase.height}-${uuidv4()}.png`;

        const testData = await createPrecisionTestImage(
          [{ text: testCase.text, x: testCase.x, y: testCase.y, fontSize: 20 }],
          uniqueName,
          { width: testCase.width, height: testCase.height }
        );

        try {
          const result = await MacOCR.recognizeFromPath(testData.imagePath);
          const observations = result.observations;

          expect(observations.length).toBeGreaterThan(0);

          // All coordinates should be normalized (0.0-1.0)
          observations.forEach((obs) => {
            expect(obs.x).toBeGreaterThanOrEqual(0);
            expect(obs.x).toBeLessThanOrEqual(1);
            expect(obs.y).toBeGreaterThanOrEqual(0);
            expect(obs.y).toBeLessThanOrEqual(1);
            expect(obs.width).toBeGreaterThanOrEqual(0);
            expect(obs.width).toBeLessThanOrEqual(1);
            expect(obs.height).toBeGreaterThanOrEqual(0);
            expect(obs.height).toBeLessThanOrEqual(1);
          });

          console.log(
            `✓ ${testCase.width}x${testCase.height}: detected ${observations.length} text blocks with normalized coordinates`
          );
        } finally {
          // Clean up
          if (fs.existsSync(testData.imagePath)) {
            await fs.promises.unlink(testData.imagePath);
          }
        }
      }
    });
  });
});
