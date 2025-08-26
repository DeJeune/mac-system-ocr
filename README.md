# @cherrystudio/mac-system-ocr

> ⚠️ **IMPORTANT UPDATE NOTICE**: Version 0.1.0 includes critical fixes for electron-builder compatibility. Please update to the latest version:
> ```bash
> npm install @cherrystudio/mac-system-ocr@latest
> # or
> yarn upgrade @cherrystudio/mac-system-ocr@latest
> ```

# Mac OCR Native Node.js Module

A high-performance OCR (Optical Character Recognition) Node.js native module powered by macOS Vision Framework. This module provides fast and accurate text recognition capabilities for various image formats.

[![npm version](https://badge.fury.io/js/@cherrystudio%2Fmac-system-ocr.svg)](https://badge.fury.io/js/@cherrystudio%2Fmac-system-ocr)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## Features

- 🚀 Native performance using macOS Vision Framework
- 🖼️ Support for multiple image formats
- 🌍 Multi-language text recognition
- ⚡️ Promise-based async API
- 📍 **Native macOS coordinate system** - coordinates exactly as returned by Vision Framework
- 🎯 Individual text observation confidence scores

## Requirements

- macOS 10.15 or later
- Node.js 23.0.0 or later (maybe support former version, but not tested)
- Xcode Command Line Tools

## Installation

```bash
npm install @cherrystudio/mac-system-ocr
```

## Development

```bash
git clone https://github.com/DeJeune/mac-system-ocr.git
cd mac-system-ocr
npm install
npm run build
```

## Quick Start

```typescript
import MacOCR from '@cherrystudio/mac-system-ocr';

// Basic usage
async function recognizeText() {
  try {
    const result = await MacOCR.recognizeFromPath('path/to/your/image.png');
    console.log('Recognized text:', result.text);
    console.log('Confidence:', result.confidence);
  } catch (error) {
    console.error('OCR failed:', error);
  }
}

// With text bounding boxes
async function recognizeWithBoundingBoxes() {
  const result = await MacOCR.recognizeFromPath('path/to/your/image.jpg', {
    languages: 'en-US, zh-Hans',
    recognitionLevel: MacOCR.RECOGNITION_LEVEL_ACCURATE,
    minConfidence: 0.5,
  });
  
  console.log('Text:', result.text);
  
  // Get observations with native macOS coordinates (bottom-left origin)
  const observations = result.getObservations();
  observations.forEach((obs, index) => {
    console.log(`Text ${index + 1}: "${obs.text}"`);
    console.log(`  Position: (${obs.x}, ${obs.y}) - bottom-left origin`);
    console.log(`  Size: ${obs.width} × ${obs.height}`);
    console.log(`  Confidence: ${obs.confidence}`);
  });
}
```

## API Reference

### `MacOCR.recognizeFromPath(imagePath: string, options?: RecognizeOptions): Promise<OCRResult>`

Performs OCR on the specified image file and returns the recognized text with detailed observations.

#### Parameters

- `imagePath` (string): Path to the image file
- `options` (optional): Configuration object for OCR

#### RecognizeOptions

```typescript
interface RecognizeOptions {
  languages?: string; // Recognition languages, multiple languages separated by commas (default: 'en-US')
  recognitionLevel?: typeof MacOCR.RECOGNITION_LEVEL_FAST | typeof MacOCR.RECOGNITION_LEVEL_ACCURATE; // Use fast recognition mode  or accurate recognition mode
  minConfidence?: number;  // Minimum confidence score (default: 0.0)
}
```

#### OCRResult

```typescript
class OCRResult {
  text: string;        // Combined recognized text
  confidence: number;  // Overall confidence score (0.0-1.0)
  
  /**
   * Get text observations with native macOS coordinates (bottom-left origin)
   * Coordinates are exactly as returned by Vision Framework without any conversion
   */
  getObservations(): TextObservation[];
}

interface TextObservation {
  text: string;       // Text content of this observation
  confidence: number; // Confidence score for this text (0.0-1.0)
  x: number;         // x coordinate from Vision Framework (0.0-1.0)
  y: number;         // y coordinate from Vision Framework (0.0-1.0, bottom-left origin)
  width: number;     // width from Vision Framework (0.0-1.0)
  height: number;    // height from Vision Framework (0.0-1.0)
}
```

#### Coordinate System

**Native macOS Coordinates (`getObservations()`)**:
- All coordinates are normalized to the range 0.0-1.0
- Uses **bottom-left origin** (0,0 = bottom-left corner of image) - native macOS/Quartz coordinate system
- `x`, `y`: Position in native macOS coordinate system
- `width`, `height`: Dimensions of the bounding box
- No coordinate conversion applied - coordinates exactly as returned by Vision Framework
- To convert to pixel coordinates: `pixelX = x * imageWidth`, `pixelY = y * imageHeight`

**Converting to Top-Left Origin** (if needed for UI frameworks):
```javascript
// Convert from macOS (bottom-left) to standard graphics (top-left)
function convertToTopLeft(obs, imageHeight = 1.0) {
  return {
    x: obs.x,
    y: imageHeight - (obs.y + obs.height), // Flip Y coordinate
    width: obs.width,
    height: obs.height
  };
}
```

#### Supported Languages

- `en-US`: English
- `zh-Hans`: Simplified Chinese
- `zh-Hant`: Traditional Chinese
- `ja-JP`: Japanese
- And more...

#### Returns

Returns a Promise that resolves with an `OCRResult` object containing the recognized text and detailed observations.

#### Errors

The following errors may be thrown:
- `FileNotFoundError`: Image file does not exist
- `InvalidFormatError`: Unsupported image format
- `OCRError`: Recognition failed

### `MacOCR.recognizeBatchFromPath(imagePaths: string[], options?: RecognizeBatchOptions): Promise<OCRResult[]>`

### `MacOCR.recognizeFromBuffer(imageBuffer: Buffer | Uint8Array, options?: RecognizeOptions): Promise<OCRResult>`

## Examples

### Basic Text Recognition

```typescript
import { MacOCR } from '@cherrystudio/mac-system-ocr';

const result = await MacOCR.recognizeFromPath('screenshot.png');
console.log(result.text);
```

### Multi-language Recognition

```typescript
import { MacOCR } from '@cherrystudio/mac-system-ocr';

const result = await MacOCR.recognizeFromPath('document.jpg', {
  languages: 'en-US, zh-Hans',
  recognitionLevel: MacOCR.RECOGNITION_LEVEL_ACCURATE,
  minConfidence: 0.5,
});
console.log(result.text);
```

### Text Bounding Boxes

```typescript
import { MacOCR } from '@cherrystudio/mac-system-ocr';

const result = await MacOCR.recognizeFromPath('image-with-text.png');

// Get observations with native macOS coordinates
const observations = result.getObservations();

observations.forEach((obs, index) => {
  console.log(`Text block ${index + 1}:`);
  console.log(`  Text: "${obs.text}"`);
  console.log(`  Confidence: ${(obs.confidence * 100).toFixed(2)}%`);
  console.log(`  Position: (${obs.x.toFixed(3)}, ${obs.y.toFixed(3)}) - bottom-left origin`);
  console.log(`  Size: ${obs.width.toFixed(3)} × ${obs.height.toFixed(3)}`);
});
```

### Drawing Bounding Boxes

```typescript
import { MacOCR } from '@cherrystudio/mac-system-ocr';

async function drawTextBoundingBoxes(imagePath: string, imageWidth: number, imageHeight: number) {
  const result = await MacOCR.recognizeFromPath(imagePath);
  const observations = result.getObservations();

  // Convert native macOS coordinates to pixel coordinates
  observations.forEach(obs => {
    const pixelCoords = {
      x: Math.round(obs.x * imageWidth),
      y: Math.round(obs.y * imageHeight), // Native bottom-left origin
      width: Math.round(obs.width * imageWidth),
      height: Math.round(obs.height * imageHeight)
    };
    
    // For drawing libraries that use top-left origin, you may need to convert:
    // const topLeftY = imageHeight - pixelCoords.y - pixelCoords.height;
    
    // Draw bounding box using your preferred graphics library
    drawRectangle(pixelCoords.x, pixelCoords.y, pixelCoords.width, pixelCoords.height);
    
    // Add text label
    drawText(obs.text, pixelCoords.x, pixelCoords.y - 5);
  });
}
```

### Buffer Recognition

```typescript
import { MacOCR } from '@cherrystudio/mac-system-ocr';
import * as fs from 'fs';

const imageBuffer = fs.readFileSync('image.png');
const result = await MacOCR.recognizeFromBuffer(imageBuffer);

console.log('Recognized text:', result.text);

// Get observations with coordinates
const observations = result.getObservations();
console.log(`Found ${observations.length} text blocks`);
```


## Performance Tips

- Use `recognitionLevel: 1` option for accurate recognition
- JPEG and PNG formats are recommended for best performance
- Ensure images have good contrast and resolution for optimal results

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

MIT License - see the [LICENSE](LICENSE) file for details.