const MacOCR = require('../src/index');
const path = require('path');
const fs = require('fs');
const { createWebpTestImage } = require('./createTestImage');
const { v4: uuidv4 } = require('uuid');

describe('WebP Format Support', () => {
  let fixturesDir;
  let testFiles = [];

  beforeAll(async () => {
    fixturesDir = path.join(__dirname, 'fixtures');
    try {
      await fs.promises.mkdir(fixturesDir, { recursive: true });
    } catch (error) {
      console.error('Error creating fixtures directory:', error);
    }
  });

  afterEach(async () => {
    // 清理测试文件
    for (const filePath of testFiles) {
      try {
        if (fs.existsSync(filePath)) {
          await fs.promises.unlink(filePath);
        }
      } catch (error) {
        console.error('Error cleaning up test file:', error);
      }
    }
    testFiles = [];
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

  describe('Single WebP Recognition', () => {
    test('should recognize text from high quality WebP image', async () => {
      const testText = 'High Quality WebP Test';
      const filename = `webp-high-quality-${uuidv4()}.webp`;
      const imagePath = await createWebpTestImage(testText, filename, {
        quality: 100,
        lossless: false
      });
      testFiles.push(imagePath);

      const result = await MacOCR.recognizeFromPath(imagePath);
      
      expect(result).toBeDefined();
      expect(result.text).toBeDefined();
      expect(result.text.toLowerCase()).toContain(testText.toLowerCase());
      expect(result.confidence).toBeGreaterThan(0);
      expect(result.observations).toBeDefined();
      expect(result.observations.length).toBeGreaterThan(0);
    });

    test('should recognize text from lossless WebP image', async () => {
      const testText = 'Lossless WebP Test';
      const filename = `webp-lossless-${uuidv4()}.webp`;
      const imagePath = await createWebpTestImage(testText, filename, {
        lossless: true
      });
      testFiles.push(imagePath);

      const result = await MacOCR.recognizeFromPath(imagePath);
      
      expect(result).toBeDefined();
      expect(result.text).toBeDefined();
      expect(result.text.toLowerCase()).toContain(testText.toLowerCase());
      expect(result.confidence).toBeGreaterThan(0);
    });

    test('should handle low quality WebP image', async () => {
      const testText = 'Low Quality WebP';
      const filename = `webp-low-quality-${uuidv4()}.webp`;
      const imagePath = await createWebpTestImage(testText, filename, {
        quality: 10,
        lossless: false
      });
      testFiles.push(imagePath);

      const result = await MacOCR.recognizeFromPath(imagePath);
      
      expect(result).toBeDefined();
      expect(result.text).toBeDefined();
      // 低质量图片可能识别率较低，但应该能识别出部分文本
      expect(typeof result.text).toBe('string');
      expect(result.confidence).toBeGreaterThanOrEqual(0);
    });

    test('should handle WebP image with transparency', async () => {
      const testText = 'Transparent WebP';
      const filename = `webp-transparent-${uuidv4()}.webp`;
      const imagePath = await createWebpTestImage(testText, filename, {
        quality: 80,
        alphaQuality: 50,
        background: { r: 255, g: 255, b: 255, alpha: 0.8 }
      });
      testFiles.push(imagePath);

      const result = await MacOCR.recognizeFromPath(imagePath);
      
      expect(result).toBeDefined();
      expect(result.text).toBeDefined();
      expect(result.text.toLowerCase()).toContain(testText.toLowerCase());
    });

    test('should handle empty WebP image gracefully', async () => {
      const filename = `webp-empty-${uuidv4()}.webp`;
      const imagePath = await createWebpTestImage('', filename, {
        quality: 80
      });
      testFiles.push(imagePath);

      const result = await MacOCR.recognizeFromPath(imagePath);
      
      expect(result).toBeDefined();
      expect(result.text).toBeDefined();
      expect(result.text).toBe('');
      expect(result.confidence).toBe(0);
      expect(result.observations).toHaveLength(0);
    });

    test('should handle very small WebP image', async () => {
      const testText = 'S';
      const filename = `webp-small-${uuidv4()}.webp`;
      const imagePath = await createWebpTestImage(testText, filename, {
        width: 30,
        height: 20,
        fontSize: 12,
        quality: 80
      });
      testFiles.push(imagePath);

      const result = await MacOCR.recognizeFromPath(imagePath);
      
      expect(result).toBeDefined();
      expect(result.text).toBeDefined();
      // 很小的图片可能无法识别，但不应该报错
      expect(typeof result.text).toBe('string');
      expect(result.confidence).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Batch WebP Recognition', () => {
    test('should process multiple WebP images in batch', async () => {
      const testTexts = ['WebP Batch 1', 'WebP Batch 2', 'WebP Batch 3'];
      const imagePaths = [];

      // 创建多个WebP测试图片
      for (let i = 0; i < testTexts.length; i++) {
        const filename = `webp-batch-${i}-${uuidv4()}.webp`;
        const imagePath = await createWebpTestImage(testTexts[i], filename, {
          quality: 80
        });
        imagePaths.push(imagePath);
        testFiles.push(imagePath);
      }

      const results = await MacOCR.recognizeBatchFromPath(imagePaths);
      
      expect(results).toBeDefined();
      expect(results).toHaveLength(testTexts.length);

      for (let i = 0; i < results.length; i++) {
        const result = results[i];
        expect(result).toBeDefined();
        expect(result.text).toBeDefined();
        expect(result.text.toLowerCase()).toContain(testTexts[i].toLowerCase());
        expect(result.confidence).toBeGreaterThan(0);
      }
    });

    test('should handle mixed quality WebP images in batch', async () => {
      const testConfigs = [
        { text: 'High Quality', options: { quality: 100 } },
        { text: 'Medium Quality', options: { quality: 50 } },
        { text: 'Low Quality', options: { quality: 10 } },
        { text: 'Lossless', options: { lossless: true } }
      ];
      const imagePaths = [];

      for (let i = 0; i < testConfigs.length; i++) {
        const config = testConfigs[i];
        const filename = `webp-mixed-${i}-${uuidv4()}.webp`;
        const imagePath = await createWebpTestImage(config.text, filename, config.options);
        imagePaths.push(imagePath);
        testFiles.push(imagePath);
      }

      const results = await MacOCR.recognizeBatchFromPath(imagePaths);
      
      expect(results).toBeDefined();
      expect(results).toHaveLength(testConfigs.length);

      // 检查每个结果
      for (let i = 0; i < results.length; i++) {
        const result = results[i];
        const expectedText = testConfigs[i].text;
        
        expect(result).toBeDefined();
        expect(result.text).toBeDefined();
        expect(typeof result.text).toBe('string');
        expect(result.confidence).toBeGreaterThanOrEqual(0);
        
        // 高质量图片应该能正确识别
        if (testConfigs[i].options.quality >= 50 || testConfigs[i].options.lossless) {
          expect(result.text.toLowerCase()).toContain(expectedText.toLowerCase());
          expect(result.confidence).toBeGreaterThan(0);
        }
      }
    });

    test('should handle problematic WebP images in batch without crashing', async () => {
      const problematicConfigs = [
        { text: '', options: { quality: 80 } }, // 空文本
        { text: 'T', options: { width: 20, height: 15, fontSize: 8, quality: 5 } }, // 极小尺寸
        { text: 'Transparent', options: { background: { r: 255, g: 255, b: 255, alpha: 0.3 }, quality: 20 } } // 高透明度
      ];
      const imagePaths = [];

      for (let i = 0; i < problematicConfigs.length; i++) {
        const config = problematicConfigs[i];
        const filename = `webp-problematic-${i}-${uuidv4()}.webp`;
        const imagePath = await createWebpTestImage(config.text, filename, config.options);
        imagePaths.push(imagePath);
        testFiles.push(imagePath);
      }

      // 这个测试的重点是确保不会崩溃
      const results = await MacOCR.recognizeBatchFromPath(imagePaths);
      
      expect(results).toBeDefined();
      expect(results).toHaveLength(problematicConfigs.length);

      // 每个结果都应该有正确的结构，即使文本为空
      for (const result of results) {
        expect(result).toBeDefined();
        expect(result.text).toBeDefined();
        expect(typeof result.text).toBe('string');
        expect(typeof result.confidence).toBe('number');
        expect(result.confidence).toBeGreaterThanOrEqual(0);
        expect(result.confidence).toBeLessThanOrEqual(1);
        expect(Array.isArray(result.observations)).toBe(true);
      }
    });

    test('should maintain consistency between single and batch recognition', async () => {
      const testText = 'Consistency Test WebP';
      const filename = `webp-consistency-${uuidv4()}.webp`;
      const imagePath = await createWebpTestImage(testText, filename, {
        quality: 90
      });
      testFiles.push(imagePath);

      // 单个识别
      const singleResult = await MacOCR.recognizeFromPath(imagePath);
      
      // 批处理识别
      const batchResults = await MacOCR.recognizeBatchFromPath([imagePath]);
      const batchResult = batchResults[0];

      // 结果应该一致
      expect(singleResult.text).toBe(batchResult.text);
      expect(singleResult.confidence).toBe(batchResult.confidence);
      expect(singleResult.observations.length).toBe(batchResult.observations.length);
    });
  });

  describe('WebP Buffer Recognition', () => {
    test('should recognize WebP from buffer', async () => {
      const testText = 'WebP Buffer Test';
      const filename = `webp-buffer-${uuidv4()}.webp`;
      const imagePath = await createWebpTestImage(testText, filename, {
        quality: 80
      });
      testFiles.push(imagePath);

      // 读取文件为buffer
      const imageBuffer = fs.readFileSync(imagePath);
      
      const result = await MacOCR.recognizeFromBuffer(imageBuffer);
      
      expect(result).toBeDefined();
      expect(result.text).toBeDefined();
      expect(result.text.toLowerCase()).toContain(testText.toLowerCase());
      expect(result.confidence).toBeGreaterThan(0);
    });

    test('should process multiple WebP buffers in batch', async () => {
      const testTexts = ['Buffer 1', 'Buffer 2'];
      const imageBuffers = [];

      for (let i = 0; i < testTexts.length; i++) {
        const filename = `webp-buffer-batch-${i}-${uuidv4()}.webp`;
        const imagePath = await createWebpTestImage(testTexts[i], filename, {
          quality: 80
        });
        testFiles.push(imagePath);
        
        const buffer = fs.readFileSync(imagePath);
        imageBuffers.push(buffer);
      }

      const results = await MacOCR.recognizeBatchFromBuffer(imageBuffers);
      
      expect(results).toBeDefined();
      expect(results).toHaveLength(testTexts.length);

      for (let i = 0; i < results.length; i++) {
        const result = results[i];
        expect(result).toBeDefined();
        expect(result.text).toBeDefined();
        expect(result.text.toLowerCase()).toContain(testTexts[i].toLowerCase());
      }
    });
  });

  describe('WebP Error Handling', () => {
    test('should handle corrupted WebP file gracefully', async () => {
      const corruptedPath = path.join(fixturesDir, `corrupted-${uuidv4()}.webp`);
      
      // 创建一个损坏的WebP文件
      const fakeWebpData = Buffer.from('RIFF\x00\x00\x00\x00WEBP', 'binary');
      fs.writeFileSync(corruptedPath, fakeWebpData);
      testFiles.push(corruptedPath);

      await expect(MacOCR.recognizeFromPath(corruptedPath))
        .rejects
        .toThrow();
    });

    test('should handle non-existent WebP file', async () => {
      const nonExistentPath = path.join(fixturesDir, 'non-existent.webp');
      
      await expect(MacOCR.recognizeFromPath(nonExistentPath))
        .rejects
        .toThrow('Image file does not exist');
    });

    test('should validate WebP file extension', async () => {
      // 创建一个PNG文件但使用.webp扩展名
      const testText = 'Fake WebP';
      const filename = `fake-webp-${uuidv4()}.png`;
      const imagePath = await createWebpTestImage(testText, filename, {
        quality: 80
      });
      testFiles.push(imagePath);

      // 重命名为.webp扩展名
      const webpPath = imagePath.replace('.png', '.webp');
      fs.renameSync(imagePath, webpPath);
      testFiles.push(webpPath);

      // 应该能正常处理，因为内容是正确的WebP格式
      const result = await MacOCR.recognizeFromPath(webpPath);
      expect(result).toBeDefined();
    });
  });

  describe('WebP Performance', () => {
    test('should process WebP images within reasonable time', async () => {
      const testText = 'Performance Test WebP';
      const filename = `webp-performance-${uuidv4()}.webp`;
      const imagePath = await createWebpTestImage(testText, filename, {
        width: 800,
        height: 600,
        fontSize: 32,
        quality: 80
      });
      testFiles.push(imagePath);

      const startTime = Date.now();
      const result = await MacOCR.recognizeFromPath(imagePath);
      const endTime = Date.now();
      
      const processingTime = endTime - startTime;
      
      expect(result).toBeDefined();
      expect(result.text.toLowerCase()).toContain(testText.toLowerCase());
      
      // WebP处理时间应该在合理范围内（5秒内）
      expect(processingTime).toBeLessThan(5000);
    }, 10000); // 设置较长的超时时间
  });
});
