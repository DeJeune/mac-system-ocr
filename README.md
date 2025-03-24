# Mac OCR Native Node.js Module

A high-performance OCR (Optical Character Recognition) Node.js native module powered by macOS Vision Framework. This module provides fast and accurate text recognition capabilities for various image formats.

[![npm version](https://badge.fury.io/js/mac-system-ocr.svg)](https://badge.fury.io/js/mac-system-ocr.svg)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## Features

- 🚀 Native performance using macOS Vision Framework
- 🖼️ Support for multiple image formats
- 🌍 Multi-language text recognition
- ⚡️ Promise-based async API

## Requirements

- macOS 10.15 or later
- Node.js 23.0.0 or later (maybe support former version, but not tested)
- Xcode Command Line Tools

## Installation

```bash
npm install mac-system-ocr
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
import MacOCR from 'mac-system-ocr';

// Basic usage
async function recognizeText() {
  try {
    const text = await MacOCR.recognize('path/to/your/image.png');
    console.log('Recognized text:', text);
  } catch (error) {
    console.error('OCR failed:', error);
  }
}

// With options
async function recognizeWithOptions() {
  const options = {
    languages: 'en-US, zh-Hans', // Specify recognition languages
    recognitionLevel: MacOCR.RECOGNITION_LEVEL_ACCURATE,
    minConfidence: 0.5,
  };
  
  const text = await MacOCR.recognize('path/to/your/image.jpg', options);
  console.log('Recognized text:', text);
}
```

## API Reference

### `MacOCR.recognize(imagePath: string, options?: OCROptions): Promise<string>`

Performs OCR on the specified image file and returns the recognized text.

#### Parameters

- `imagePath` (string): Path to the image file
- `options` (optional): Configuration object for OCR

#### OCROptions

```typescript
interface RecognizeOptions {
  languages?: string; // Recognition languages, multiple languages separated by commas (default: 'en-US')
  recognitionLevel?: typeof MacOCR.RECOGNITION_LEVEL_FAST | typeof MacOCR.RECOGNITION_LEVEL_ACCURATE; // Use fast recognition mode  or accurate recognition mode
  minConfidence?: number;  // Minimum confidence score (default: 0.0)
}
```

#### Supported Languages

- `en-US`: English
- `zh-Hans`: Simplified Chinese
- `zh-Hant`: Traditional Chinese
- `ja-JP`: Japanese
- And more...

#### Returns

Returns a Promise that resolves with the recognized text string.

#### Errors

The following errors may be thrown:
- `FileNotFoundError`: Image file does not exist
- `InvalidFormatError`: Unsupported image format
- `OCRError`: Recognition failed

## Examples

### Basic Text Recognition

```typescript
import { MacOCR } from 'mac-system-ocr';

const text = await MacOCR.recognize('screenshot.png');
console.log(text);
```

### Multi-language Recognition

```typescript
import { MacOCR } from 'mac-system-ocr';

const text = await MacOCR.recognize('document.jpg', {
  languages: ['en-US', 'zh-Hans'],
  recognitionLevel: MacOCR.RECOGNITION_LEVEL_ACCURATE,
  minConfidence: 0.5,
});
console.log(text);
```

## Performance Tips

- Use `recognitionLevel: 1` option for accurate recognition
- JPEG and PNG formats are recommended for best performance
- Ensure images have good contrast and resolution for optimal results

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

MIT License - see the [LICENSE](LICENSE) file for details.