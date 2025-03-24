const { recognize } = require('bindings')('mac_system_ocr');
const path = require('path');
const fs = require('fs');
const { createTestImage } = require('./createTestImage');
const { v4: uuidv4 } = require('uuid');

describe('Native Binding', () => {
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

    const uniqueName = `test-${uuidv4()}.png`;
    testImagePath = await createTestImage('native binding test', uniqueName);
    
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

  test('recognize function should exist', () => {
    expect(typeof recognize).toBe('function');
  });

  test('should perform OCR on test image', async () => {
    expect(fs.existsSync(testImagePath)).toBe(true);
    const options = {
      languages: 'en-US',
      recognitionLevel: 1, // Accurate
      minConfidence: 0.0
    };

    const result = await recognize(testImagePath, options);
    expect(result).toBeDefined();
    expect(result.text).toBeDefined();
    expect(typeof result.text).toBe('string');
    expect(result.confidence).toBeDefined();
    expect(typeof result.confidence).toBe('number');
    expect(result.confidence).toBeGreaterThanOrEqual(0);
    expect(result.confidence).toBeLessThanOrEqual(1);
    expect(result.text.toLowerCase()).toContain('native binding test');
  });

  test('should handle invalid image path', async () => {
    const options = {
      languages: 'en-US',
      recognitionLevel: 1,
      minConfidence: 0.0
    };

    await expect(recognize('nonexistent.png', options))
      .rejects
      .toThrow('File does not exist');
  });

  test('should handle invalid options', async () => {
    expect(fs.existsSync(testImagePath)).toBe(true);
    
    try {
      await recognize(testImagePath, { recognitionLevel: 999 });
      fail('Should have thrown an error');
    } catch (error) {
      expect(error).toBeDefined();
    }
    expect(fs.existsSync(testImagePath)).toBe(true);

    try {
      await recognize(testImagePath, { minConfidence: 2.0 });
      fail('Should have thrown an error');
    } catch (error) {
      console.log('Actual error for invalid confidence:', error.message);
      expect(error).toBeDefined();
    }

    expect(fs.existsSync(testImagePath)).toBe(true);

    try {
      await recognize(testImagePath, null);
      fail('Should have thrown an error');
    } catch (error) {
      console.log('Actual error for null options:', error.message);
      expect(error).toBeDefined();
    }
  });

  test('should work with different recognition levels', async () => {
    expect(fs.existsSync(testImagePath)).toBe(true);

    const fastResult = await recognize(testImagePath, {
      languages: 'en-US',
      recognitionLevel: 0, // Fast
      minConfidence: 0.0
    });
    expect(fastResult).toBeDefined();
    expect(fastResult.text).toBeDefined();
    
    expect(fs.existsSync(testImagePath)).toBe(true);

    const accurateResult = await recognize(testImagePath, {
      languages: 'en-US',
      recognitionLevel: 1, // Accurate
      minConfidence: 0.0
    });
    expect(accurateResult).toBeDefined();
    expect(accurateResult.text).toBeDefined();
  });

  test('should respect minimum confidence threshold', async () => {
    expect(fs.existsSync(testImagePath)).toBe(true);

    const options = {
      languages: 'en-US',
      recognitionLevel: 1,
      minConfidence: 0.8 // High confidence threshold
    };

    const result = await recognize(testImagePath, options);
    expect(result.confidence).toBeGreaterThanOrEqual(0.8);
  });
}); 