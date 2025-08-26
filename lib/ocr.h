#ifndef MAC_OCR_H
#define MAC_OCR_H

#ifdef __cplusplus
extern "C" {
#endif

#include <CoreGraphics/CoreGraphics.h>

/**
 * OCR recognition level
 */
typedef enum {
    OCR_RECOGNITION_LEVEL_FAST = 0,    // fast mode
    OCR_RECOGNITION_LEVEL_ACCURATE = 1  // accurate mode
} OCRRecognitionLevel;

/**
 * Text observation structure containing text and native macOS coordinates
 * Coordinates are exactly as returned by Vision Framework without any conversion
 * Uses bottom-left origin coordinate system (native macOS/Quartz)
 */
typedef struct {
    const char* text;     // recognized text
    double confidence;    // confidence for this text
    double x;             // x coordinate from Vision Framework (0.0-1.0)
    double y;             // y coordinate from Vision Framework (0.0-1.0, bottom-left origin)
    double width;         // width from Vision Framework (0.0-1.0)
    double height;        // height from Vision Framework (0.0-1.0)
} TextObservation;

/**
 * OCR result structure with detailed observations
 * Note: All string fields are dynamically allocated and need to be freed using free_ocr_result
 */
typedef struct {
    const char* error;    // error message, NULL if no error
    const char* text;     // recognized text, NULL if an error occurred
    double confidence;    // recognition confidence 0.0-1.0
    TextObservation* observations;  // array of text observations (native macOS coordinates)
    size_t observation_count;       // number of observations
} OCRResult;

/**
 * OCR options structure
 * All fields are optional, and if NULL or 0, the default value will be used
 */
typedef struct {
    const char* languages;     // recognition languages, e.g. "zh-Hans,en-US", NULL uses default language
    OCRRecognitionLevel recognition_level;     // recognition level: OCR_RECOGNITION_LEVEL_FAST or OCR_RECOGNITION_LEVEL_ACCURATE
    double min_confidence;     // minimum confidence threshold 0.0-1.0, default is 0.0
} OCROptions;

/**
 * Batch OCR result structure
 */
typedef struct {
    const char* error;         // overall error message, NULL if no error
    OCRResult** results;       // OCR results array
    size_t count;             // number of results
    size_t failed_count;      // number of failed results
} OCRBatchResult;

/**
 * Batch OCR options structure
 */
typedef struct {
    OCROptions ocr_options;    // OCR basic options
    int max_threads;           // maximum number of threads, default is the number of system CPU cores
    int batch_size;           // batch size, default is 1
} OCRBatchOptions;

/**
 * Create CGImage from buffer data
 * @param buffer pointer to the image data buffer
 * @param length length of the buffer
 * @param error pointer to store error message, NULL if no error
 * @return CGImageRef if successful, NULL if failed
 */
CGImageRef CreateCGImageFromBuffer(const void* buffer, size_t length, char** error);

/**
 * Perform OCR recognition
 * @param CGImageRef CoreGraphics Image Reference
 * @param options OCR options, can be NULL to use default values
 * @return OCRResult structure pointer, NULL if memory allocation fails
 * @note The returned structure must be freed using free_ocr_result
 * 
 * Supported image formats:
 * - JPEG (.jpg, .jpeg)
 * - PNG (.png)
 * - TIFF (.tiff)
 * - GIF (.gif)
 */
OCRResult* perform_ocr(CGImageRef image, const OCROptions* options);

/**
 * Perform batch OCR recognition
 * @param image_paths image file path array
 * @param count number of image files
 * @param options batch processing options, can be NULL to use default values
 * @return OCRBatchResult structure pointer
 * @note The returned structure must be freed using free_ocr_batch_result
 */
OCRBatchResult* perform_batch_ocr(const char** image_paths, size_t count, const OCRBatchOptions* options);

/**
 * Perform batch OCR recognition from buffers
 * @param buffers array of buffer pointers
 * @param lengths array of buffer lengths
 * @param count number of buffers
 * @param options batch processing options, can be NULL to use default values
 * @return OCRBatchResult structure pointer
 * @note The returned structure must be freed using free_ocr_batch_result
 */
OCRBatchResult* perform_batch_ocr_from_buffers(const void** buffers, const size_t* lengths, size_t count, const OCRBatchOptions* options);

/**
 * Free OCR result
 * @param result pointer to the OCR result to be freed, can be NULL
 * @note After freeing, do not access result or its fields
 */
void free_ocr_result(OCRResult* result);

/**
 * Free batch OCR result
 * @param result pointer to the batch OCR result to be freed, can be NULL
 */
void free_ocr_batch_result(OCRBatchResult* result);

#ifdef __cplusplus
}
#endif

#endif // MAC_OCR_H 