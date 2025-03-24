// Test/memory.js
const MacOCR = require('../src/index');
const v8 = require('v8');

function formatBytes(bytes) {
  return (bytes / 1024 / 1024).toFixed(2) + ' MB';
}

function getMemoryInfo() {
  const memoryUsage = process.memoryUsage();
  const heapStats = v8.getHeapStatistics();
  
  return {
    rss: memoryUsage.rss,
    heapTotal: memoryUsage.heapTotal,
    heapUsed: memoryUsage.heapUsed,
    external: memoryUsage.external,
    heapSizeLimit: heapStats.heap_size_limit,
    totalAvailable: heapStats.total_available_size
  };
}

async function runMemoryTests() {
  const iterations = 1000;
  const sampleInterval = 100;
  const memorySnapshots = [];
  
  console.log('Start memory tests...\n');
  console.log('Initial memory state:');
  const initialMemory = getMemoryInfo();
  Object.entries(initialMemory).forEach(([key, value]) => {
    console.log(`- ${key}: ${formatBytes(value)}`);
  });
  console.log('\nStart testing iterations...');

  try {
    for (let i = 0; i < iterations; i++) {
      await MacOCR.recognize('./images/test.png');
      
      if (i % sampleInterval === 0) {
        // 强制进行垃圾回收
        if (global.gc) {
          global.gc();
        }
        
        const currentMemory = getMemoryInfo();
        const memoryDiff = {
          iteration: i,
          timestamp: Date.now(),
          heapUsed: currentMemory.heapUsed - initialMemory.heapUsed,
          rss: currentMemory.rss - initialMemory.rss
        };
        
        memorySnapshots.push(memoryDiff);
        
        console.log(`\nIteration ${i}:`);
        console.log(`- Heap memory growth: ${formatBytes(memoryDiff.heapUsed)}`);
        console.log(`- RSS memory growth: ${formatBytes(memoryDiff.rss)}`);
        console.log(`- Heap memory usage: ${((currentMemory.heapUsed / currentMemory.heapSizeLimit) * 100).toFixed(2)}%`);
      }
    }

    // 最终内存分析
    console.log('\nMemory test summary:');
    const finalMemory = getMemoryInfo();
    const totalChange = {
      heapUsed: finalMemory.heapUsed - initialMemory.heapUsed,
      rss: finalMemory.rss - initialMemory.rss
    };

    console.log('Memory changes:');
    console.log(`- Total heap memory growth: ${formatBytes(totalChange.heapUsed)}`);
    console.log(`- Total RSS memory growth: ${formatBytes(totalChange.rss)}`);
    
    const leakThreshold = 50 * 1024 * 1024; // 50MB
    if (totalChange.heapUsed > leakThreshold) {
      console.warn('\n⚠️ Warning: Potential memory leak detected');
      console.warn(`Continuous memory growth exceeds ${formatBytes(leakThreshold)}`);
    }

    console.log('\nDetailed memory snapshot data:');
    console.table(memorySnapshots.map(snapshot => ({
      'Iteration': snapshot.iteration,
      'Heap memory growth': formatBytes(snapshot.heapUsed),
      'RSS memory growth': formatBytes(snapshot.rss)
    })));

  } catch (error) {
    console.error('Error occurred during memory test:', error);
    throw error;
  }
}

module.exports = runMemoryTests;

if (require.main === module) {
  if (!global.gc) {
    console.warn('Use --expose-gc parameter to run the test to get more accurate memory usage data');
    console.warn('Example: node --expose-gc test/memory.js\n');
  }
  
  runMemoryTests().catch(console.error);
}