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
 * @returns {Promise<string>} 图片文件路径
 */
function createTestImage(text, filename, options = {}) {
    const width = options.width || 200;
    const height = options.height || 200;
    const fontSize = options.fontSize || 30;
    const format = options.format || path.extname(filename).slice(1) || 'png';
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
        top: Math.floor(height / 4),
        left: Math.floor(width / 4)
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

module.exports = {
    createTestImage
}