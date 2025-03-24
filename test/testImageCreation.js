const { createTestImage } = require('./createTestImage');

// 测试创建图片
createTestImage('测试文字 Test Text').then(imagePath => {
    console.log('图片已创建在:', imagePath); 
});