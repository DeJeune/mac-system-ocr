const MacOCR = require('../src/index.js');
const path = require('path');

async function demo() {
  try {
    // 你可以替换为任何包含文字的图片路径
    const imagePath = process.argv[2] || path.join(__dirname, 'test.png');
    
    console.log(`Start processing: ${imagePath}`);
    console.log('Processing...');

    const result = await MacOCR.recognizeFromPath(imagePath, {
      recognitionLevel: 1, 
      minConfidence: 0.5
    });

    console.log('\nRecognition result:');
    console.log('----------------------------------------');
    console.log(result.text);
    console.log('----------------------------------------');
    console.log(`Overall Confidence: ${(result.confidence * 100).toFixed(2)}%`);

    // Demonstrate getObservations functionality
    const observations = result.getObservations();
    if (observations.length > 0) {
      console.log('\nDetailed text observations with bounding boxes:');
      console.log('========================================');
      observations.forEach((obs, index) => {
        console.log(`Text ${index + 1}: "${obs.text}"`);
        console.log(`  Confidence: ${(obs.confidence * 100).toFixed(2)}%`);
        console.log(`  Position: x=${obs.x.toFixed(3)}, y=${obs.y.toFixed(3)}`);
        console.log(`  Size: width=${obs.width.toFixed(3)}, height=${obs.height.toFixed(3)}`);
        console.log('  ----------------------------------------');
      });
      console.log(`Total text blocks detected: ${observations.length}`);
    } else {
      console.log('\nNo detailed observations available.');
    }

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