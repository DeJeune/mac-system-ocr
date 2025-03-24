const sharp = require('sharp');
const path = require('path');

// Helper function to create a test image
function createTestImage(text, filename) {
    const width = 200;
    const height = 200;
    const testImagePath = path.join(__dirname, 'fixtures', filename);

    // Create a new image with white background
    return sharp({
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
                fontSize: 30,
                rgba: true
            }
        },
        top: 50,
        left: 50
    }])
    .png({ quality: 100, compressionLevel: 1 })
    .toFile(testImagePath)
    .then(() => testImagePath);
}

module.exports = {
    createTestImage
}