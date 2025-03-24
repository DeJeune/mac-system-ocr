const MacOCR = require('../lib');
const path = require('path');

async function demo() {
  try {
    // 你可以替换为任何包含文字的图片路径
    const imagePath = process.argv[2] || path.join(__dirname, 'test.png');
    
    console.log(`Start processing: ${imagePath}`);
    console.log('Processing...');

    const result = await MacOCR.recognize(imagePath, {
      recognitionLevel: 1, 
      minConfidence: 0.5
    });

    console.log('\nRecognition result:');
    console.log('----------------------------------------');
    console.log(result.text);
    console.log('----------------------------------------');
    console.log(`Confidence: ${(result.confidence * 100).toFixed(2)}%`);

  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

// 如果直接运行此文件
if (require.main === module) {
  if (process.argv.length < 3) {
    console.log('用法: node demo.js <图片路径>');
    console.log('例如: node demo.js ../test/sample.png');
  }
  demo();
} 