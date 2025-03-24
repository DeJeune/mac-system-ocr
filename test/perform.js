// test/performance.js
const MacOCR = require('../lib');
const { performance } = require('perf_hooks');
const path = require('path');
const fs = require('fs').promises;

async function measurePerformance(filePath) {
  const metrics = {
    totalTime: 0,
    fileSize: 0,
    processingSpeed: 0
  };

  try {
    const stats = await fs.stat(filePath);
    metrics.fileSize = stats.size / 1024; // KB

    const start = performance.now();
    await MacOCR.recognize(filePath);
    const end = performance.now();

    metrics.totalTime = end - start;
    metrics.processingSpeed = metrics.fileSize / (metrics.totalTime / 1000); // KB/s

    return metrics;
  } catch (error) {
    console.error(`Error processing ${filePath}:`, error);
    throw error;
  }
}

async function runPerformanceTests() {
  const testCases = [
    { name: 'small picture (100KB)', file: './images/small.png' },
    { name: 'medium picture (1MB)', file: './images/medium.png' },
    { name: 'large picture (5MB)', file: './images/large.png' }
  ];

  console.log('Start performance tests...\n');
  console.log('Test environment information:');
  console.log('- Node.js version:', process.version);
  console.log('- System:', process.platform, process.arch);
  console.log('- CPU:', require('os').cpus()[0].model);
  console.log('- Total memory:', Math.round(require('os').totalmem() / 1024 / 1024 / 1024), 'GB\n');

  const results = [];

  for (const test of testCases) {
    console.log(`TEST: ${test.name}`);
    
    try {
      // Run 3 times and take the average
      const runs = [];
      for (let i = 0; i < 3; i++) {
        const metrics = await measurePerformance(test.file);
        runs.push(metrics);
      }

      const avgMetrics = {
        totalTime: runs.reduce((sum, r) => sum + r.totalTime, 0) / runs.length,
        fileSize: runs[0].fileSize,
        processingSpeed: runs.reduce((sum, r) => sum + r.processingSpeed, 0) / runs.length
      };

      results.push({ ...test, metrics: avgMetrics });

      console.log(`- File size: ${avgMetrics.fileSize.toFixed(2)} KB`);
      console.log(`- Average processing time: ${avgMetrics.totalTime.toFixed(2)} ms`);
      console.log(`- Average processing speed: ${avgMetrics.processingSpeed.toFixed(2)} KB/s\n`);
    } catch (error) {
      console.error(`Test failed: ${test.name}`);
      console.error(error);
    }
  }

  console.log('Performance test summary:');
  console.table(results.map(r => ({
    'Test case': r.name,
    'File size (KB)': r.metrics.fileSize.toFixed(2),
    'Processing time (ms)': r.metrics.totalTime.toFixed(2),
    'Processing speed (KB/s)': r.metrics.processingSpeed.toFixed(2)
  })));
}

module.exports = runPerformanceTests;

if (require.main === module) {
  runPerformanceTests().catch(console.error);
}