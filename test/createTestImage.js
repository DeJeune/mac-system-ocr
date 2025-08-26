const sharp = require('sharp');
const path = require('path');

/**
 * 创建测试图片
 * @param {string} text - 要渲染的文本
 * @param {string} filename - 输出文件名
 * @param {Object} [options] - 图片选项
 * @param {number} [options.width=200] - 图片宽度
 * @param {number} [options.height=200] - 图片高度
 * @param {number} [options.fontSize=30] - 字体大小
 * @param {string} [options.format='png'] - 输出格式 (png, jpeg, gif)
 * @param {number} [options.left] - 文字左边距（像素），默认为width/4
 * @param {number} [options.top] - 文字上边距（像素），默认为height/4
 * @returns {Promise<string>} 图片文件路径
 */
function createTestImage(text, filename, options = {}) {
    const width = options.width || 200;
    const height = options.height || 200;
    const fontSize = options.fontSize || 30;
    const format = options.format || path.extname(filename).slice(1) || 'png';
    const left = options.left !== undefined ? options.left : Math.floor(width / 4);
    const top = options.top !== undefined ? options.top : Math.floor(height / 4);
    const testImagePath = path.join(__dirname, 'fixtures', filename);

    // Create a new image with white background
    const image = sharp({
        create: {
            width: width,
            height: height,
            channels: 4,
            background: { r: 255, g: 255, b: 255, alpha: 1 }
        }
    })
    .composite([{
        input: {
            text: {
                text: text,
                font: 'sans-serif',
                fontSize: fontSize,
                rgba: true
            }
        },
        top: top,
        left: left
    }]);

    // 根据不同格式设置输出选项
    switch (format.toLowerCase()) {
        case 'jpg':
        case 'jpeg':
            return image.jpeg({ quality: 100 }).toFile(testImagePath).then(() => testImagePath);
        case 'gif':
            return image.gif().toFile(testImagePath).then(() => testImagePath);
        default:
            return image.png({ quality: 100, compressionLevel: 1 }).toFile(testImagePath).then(() => testImagePath);
    }
}

/**
 * 创建具有精确位置的测试图片，用于坐标验证
 * @param {Array} textBlocks - 文字块数组，每个元素包含 {text, x, y, fontSize}
 * @param {string} filename - 输出文件名
 * @param {Object} [options] - 图片选项
 * @param {number} [options.width=400] - 图片宽度
 * @param {number} [options.height=300] - 图片高度
 * @returns {Promise<{imagePath: string, expectedCoordinates: Array}>} 图片路径和期望的坐标
 */
function createPrecisionTestImage(textBlocks, filename, options = {}) {
    const width = options.width || 400;
    const height = options.height || 300;
    const testImagePath = path.join(__dirname, 'fixtures', filename);
    
    const composites = [];
    const expectedCoordinates = [];

    textBlocks.forEach((block, _index) => {
        const fontSize = block.fontSize || 24;
        const left = block.x;
        const top = block.y;
        
        composites.push({
            input: {
                text: {
                    text: block.text,
                    font: 'sans-serif',
                    fontSize: fontSize,
                    rgba: true
                }
            },
            top: top,
            left: left
        });

        // 估算文字尺寸（这是近似值，实际OCR可能会有些许差异）
        const estimatedWidth = block.text.length * fontSize * 0.6; // 近似字符宽度
        const estimatedHeight = fontSize * 1.2; // 近似行高

        expectedCoordinates.push({
            text: block.text,
            // 转换为归一化坐标
            x: left / width,
            y: top / height,
            width: Math.min(estimatedWidth / width, 1.0), // 防止超过1.0
            height: Math.min(estimatedHeight / height, 1.0),
            // 存储原始像素坐标用于调试
            pixelX: left,
            pixelY: top,
            pixelWidth: estimatedWidth,
            pixelHeight: estimatedHeight
        });
    });

    const image = sharp({
        create: {
            width: width,
            height: height,
            channels: 4,
            background: { r: 255, g: 255, b: 255, alpha: 1 }
        }
    }).composite(composites);

    return image.png({ quality: 100, compressionLevel: 1 })
        .toFile(testImagePath)
        .then(() => ({ imagePath: testImagePath, expectedCoordinates }));
}

module.exports = {
    createTestImage,
    createPrecisionTestImage
}