#import <Foundation/Foundation.h>
#import <Vision/Vision.h>
#import <AppKit/AppKit.h>
#import "ocr.h"
#include <atomic>


static const OCROptions DEFAULT_OPTIONS = {
    .languages = "en-US",
    .recognition_level = OCR_RECOGNITION_LEVEL_ACCURATE,
    .min_confidence = 0.0
};

static const OCRBatchOptions DEFAULT_BATCH_OPTIONS = {
    .ocr_options = {
        .languages = "en-US",
        .recognition_level = OCR_RECOGNITION_LEVEL_ACCURATE,
        .min_confidence = 0.0
    },
    .max_threads = 0,
    .batch_size = 1
};

static BOOL isValidImageExtension(NSString* extension) {
    static NSSet* validExtensions = nil;
    static dispatch_once_t onceToken;
    dispatch_once(&onceToken, ^{
        validExtensions = [NSSet setWithArray:@[@"jpg", @"jpeg", @"png", @"tiff", @"gif"]];
    });
    return [validExtensions containsObject:extension.lowercaseString];
}

static int getSystemThreadCount(void) {
    return (int)[[NSProcessInfo processInfo] processorCount];
}

CGImageRef CreateCGImageFromPath(const char* path, char** error) {
    if (!path || !error) {
        if (error) *error = strdup("Invalid parameters");
        return NULL;
    }
    
    @autoreleasepool {
        NSString* imagePath = [NSString stringWithUTF8String:path];
        if (!imagePath) {
            *error = strdup("Failed to create NSString from path");
            return NULL;
        }
        
        if (![[NSFileManager defaultManager] fileExistsAtPath:imagePath]) {
            *error = strdup("File does not exist");
            return NULL;
        }

        NSString* extension = [imagePath pathExtension].lowercaseString;
        if (!isValidImageExtension(extension)) {
            *error = strdup("Invalid image file extension");
            return NULL;
        }

        NSData* imageData = [NSData dataWithContentsOfFile:imagePath];
        if (!imageData) {
            *error = strdup("Failed to read image data");
            return NULL;
        }

        CGImageSourceRef imageSource = CGImageSourceCreateWithData((__bridge CFDataRef)imageData, NULL);
        if (!imageSource) {
            *error = strdup("Failed to create image source");
            return NULL;
        }
        
        CGImageRef cgImage = CGImageSourceCreateImageAtIndex(imageSource, 0, NULL);
        CFRelease(imageSource);
        
        if (!cgImage) {
            *error = strdup("Failed to create CGImage from source");
            return NULL;
        }
        
        return cgImage;
    }
}

CGImageRef CreateCGImageFromBuffer(const void* buffer, size_t length, char** error) {
    if (!buffer || length == 0 || !error) {
        if (error) *error = strdup("Invalid parameters");
        return NULL;
    }
    
    @autoreleasepool {
        NSData* imageData = [NSData dataWithBytes:buffer length:length];
        if (!imageData) {
            *error = strdup("Failed to create NSData from buffer");
            return NULL;
        }

        CGImageSourceRef imageSource = CGImageSourceCreateWithData((__bridge CFDataRef)imageData, NULL);
        if (!imageSource) {
            *error = strdup("Failed to create image source from buffer");
            return NULL;
        }
        
        CGImageRef cgImage = CGImageSourceCreateImageAtIndex(imageSource, 0, NULL);
        CFRelease(imageSource);
        
        if (!cgImage) {
            *error = strdup("Failed to create CGImage from buffer source");
            return NULL;
        }
        
        return cgImage;
    }
}

OCRResult* perform_ocr(CGImageRef image, const OCROptions* options) {
    @autoreleasepool {
        OCRResult* result = (OCRResult*)malloc(sizeof(OCRResult));
        if (!result) {
            return NULL;
        }
        result->error = NULL;
        result->text = NULL;
        result->confidence = 0.0;
        
        const OCROptions* opts = options ? options : &DEFAULT_OPTIONS;
        
        if (!image) {
            result->error = strdup("CGImage is required and cannot be NULL");
            return result;
        }
        
        __block NSMutableString* recognizedText = [NSMutableString string];
        __block double totalConfidence = 0.0;
        __block int observationCount = 0;
        __block NSLock* resultLock = [[NSLock alloc] init];
        
        VNRecognizeTextRequest* request = [[VNRecognizeTextRequest alloc] 
            initWithCompletionHandler:^(VNRequest* request, NSError* error) {
                if (error) {
                    return;
                }
                
                NSArray<VNRecognizedTextObservation*>* observations = request.results;
                [resultLock lock];
                for (VNRecognizedTextObservation* observation in observations) {
                    NSArray<VNRecognizedText*>* candidates = [observation topCandidates:5];
                    
                    VNRecognizedText* bestCandidate = nil;
                    for (VNRecognizedText* candidate in candidates) {
                        if (candidate.confidence >= opts->min_confidence) {
                            bestCandidate = candidate;
                            break;
                        }
                    }
                    
                    if (bestCandidate) {
                        NSString* text = bestCandidate.string;
                        if (text.length > 0) {
                            if (recognizedText.length > 0) {
                                CGRect boundingBox = observation.boundingBox;
                                if (boundingBox.origin.y < 0.1) {
                                    [recognizedText appendString:@"\n"];
                                } else {
                                    [recognizedText appendString:@" "];
                                }
                            }
                            [recognizedText appendString:text];
                        }
                        totalConfidence += bestCandidate.confidence;
                        observationCount++;
                    }
                }
                [resultLock unlock];
            }];
        
        request.recognitionLevel = opts->recognition_level == OCR_RECOGNITION_LEVEL_FAST ? 
            VNRequestTextRecognitionLevelFast : 
            VNRequestTextRecognitionLevelAccurate;
        
        if (opts->languages) {
            NSString* langs = [NSString stringWithUTF8String:opts->languages];
            request.recognitionLanguages = [langs componentsSeparatedByString:@","];
        }
        
        if (@available(macOS 13.0, *)) {
            request.automaticallyDetectsLanguage = YES;
            request.revision = VNRecognizeTextRequestRevision3;
            request.preferBackgroundProcessing = YES;
        } else {
            request.usesLanguageCorrection = YES;
        }
        
        request.minimumTextHeight = 0.008;
        request.customWords = @[];
        
        if (!request.recognitionLanguages || request.recognitionLanguages.count == 0) {
            request.recognitionLanguages = @[@"en-US"];
        }
        
        NSDictionary* options = @{};
        
        NSError* error = nil;
        VNImageRequestHandler* handler = [[VNImageRequestHandler alloc] 
                                        initWithCGImage:image
                                        orientation:kCGImagePropertyOrientationUp
                                        options:options];
        
        if (![handler performRequests:@[request] error:&error]) {
            const char* errorStr = error.localizedDescription.UTF8String;
            result->error = errorStr ? strdup(errorStr) : strdup("Unknown error occurred during OCR");
            return result;
        }
        
        if (observationCount > 0) {
            const char* textStr = [recognizedText UTF8String];
            if (textStr) {
                result->text = strdup(textStr);
                if (!result->text) {
                    result->error = strdup("Memory allocation failed for OCR text");
                    return result;
                }
            } else {
                result->text = strdup("");
            }
            result->confidence = totalConfidence / observationCount;
        } else {
            result->text = strdup("");
            if (!result->text) {
                result->error = strdup("Memory allocation failed for empty text");
                return result;
            }
            result->confidence = 0.0;
        }
        
        return result;
    }
}

void free_ocr_result(OCRResult* result) {
    if (!result) return;
    
    if (result->error) {
        free((void*)result->error);
        result->error = NULL;
    }
    
    if (result->text) {
        free((void*)result->text);
        result->text = NULL;
    }
    
    free(result);
}

void free_ocr_batch_result(OCRBatchResult* result) {
    if (!result) return;
    
    if (result->error) {
        free((void*)result->error);
    }
    
    if (result->results) {
        for (size_t i = 0; i < result->count; i++) {
            if (result->results[i]) {
                free_ocr_result(result->results[i]);
            }
        }
        free(result->results);
    }
    
    free(result);
}

OCRBatchResult* perform_batch_ocr(const char** image_paths, size_t count, const OCRBatchOptions* options) {
    @autoreleasepool {
        // 分配批处理结果结构体
        OCRBatchResult* batch_result = (OCRBatchResult*)malloc(sizeof(OCRBatchResult));
        if (!batch_result) {
            return NULL;
        }

        batch_result->error = NULL;
        batch_result->results = NULL;
        batch_result->count = count;
        batch_result->failed_count = 0;

        if (!image_paths || count == 0) {
            batch_result->error = strdup("No image paths provided");
            return batch_result;
        }

        const OCRBatchOptions* opts = options ? options : &DEFAULT_BATCH_OPTIONS;
        
        int thread_count = opts->max_threads > 0 ? 
            opts->max_threads : getSystemThreadCount();
        
        batch_result->results = (OCRResult**)calloc(count, sizeof(OCRResult*));
        if (!batch_result->results) {
            batch_result->error = strdup("Memory allocation failed for results array");
            return batch_result;
        }

        dispatch_queue_t queue = dispatch_get_global_queue(DISPATCH_QUEUE_PRIORITY_DEFAULT, 0);
        dispatch_group_t group = dispatch_group_create();
        
        dispatch_semaphore_t sema = dispatch_semaphore_create(thread_count);

        std::atomic<int64_t>* atomic_failed_count = reinterpret_cast<std::atomic<int64_t>*>(&batch_result->failed_count);

        for (size_t i = 0; i < count; i++) {
            const char* current_path = image_paths[i];
            size_t current_index = i;
            
            dispatch_semaphore_wait(sema, DISPATCH_TIME_FOREVER);
            dispatch_group_async(group, queue, ^{
                @autoreleasepool {
                    char* error = NULL;
                    CGImageRef image = CreateCGImageFromPath(current_path, &error);
                    
                    if (!image) {
                        OCRResult* result = (OCRResult*)malloc(sizeof(OCRResult));
                        result->error = error ? error : strdup("Failed to create image");
                        result->text = NULL;
                        result->confidence = 0.0;
                        batch_result->results[current_index] = result;
                        atomic_failed_count->fetch_add(1, std::memory_order_relaxed);
                        return;
                    }

                    OCRResult* result = perform_ocr(image, &opts->ocr_options);

                    CGImageRelease(image);

                    batch_result->results[current_index] = result;

                    if (result && result->error) {
                        atomic_failed_count->fetch_add(1, std::memory_order_relaxed);
                    }
                    
                    dispatch_semaphore_signal(sema);
                }
            });
        }

        dispatch_group_wait(group, DISPATCH_TIME_FOREVER);
        
        return batch_result;
    }
}

OCRBatchResult* perform_batch_ocr_from_buffers(const void** buffers, const size_t* lengths, size_t count, const OCRBatchOptions* options) {
    @autoreleasepool {
        // 分配批处理结果结构体
        OCRBatchResult* batch_result = (OCRBatchResult*)malloc(sizeof(OCRBatchResult));
        if (!batch_result) {
            return NULL;
        }

        batch_result->error = NULL;
        batch_result->results = NULL;
        batch_result->count = count;
        batch_result->failed_count = 0;

        if (!buffers || !lengths || count == 0) {
            batch_result->error = strdup("No image buffers provided");
            return batch_result;
        }

        const OCRBatchOptions* opts = options ? options : &DEFAULT_BATCH_OPTIONS;
        
        int thread_count = opts->max_threads > 0 ? 
            opts->max_threads : getSystemThreadCount();
        
        batch_result->results = (OCRResult**)calloc(count, sizeof(OCRResult*));
        if (!batch_result->results) {
            batch_result->error = strdup("Memory allocation failed for results array");
            return batch_result;
        }

        dispatch_queue_t queue = dispatch_get_global_queue(DISPATCH_QUEUE_PRIORITY_DEFAULT, 0);
        dispatch_group_t group = dispatch_group_create();
        
        dispatch_semaphore_t sema = dispatch_semaphore_create(thread_count);

        std::atomic<int64_t>* atomic_failed_count = reinterpret_cast<std::atomic<int64_t>*>(&batch_result->failed_count);

        for (size_t i = 0; i < count; i++) {
            const void* current_buffer = buffers[i];
            size_t current_length = lengths[i];
            size_t current_index = i;
            
            dispatch_semaphore_wait(sema, DISPATCH_TIME_FOREVER);
            dispatch_group_async(group, queue, ^{
                @autoreleasepool {
                    char* error = NULL;
                    CGImageRef image = CreateCGImageFromBuffer(current_buffer, current_length, &error);
                    
                    if (!image) {
                        OCRResult* result = (OCRResult*)malloc(sizeof(OCRResult));
                        result->error = error ? error : strdup("Failed to create image from buffer");
                        result->text = NULL;
                        result->confidence = 0.0;
                        batch_result->results[current_index] = result;
                        atomic_failed_count->fetch_add(1, std::memory_order_relaxed);
                        dispatch_semaphore_signal(sema);
                        return;
                    }

                    OCRResult* result = perform_ocr(image, &opts->ocr_options);

                    CGImageRelease(image);

                    batch_result->results[current_index] = result;

                    if (result && result->error) {
                        atomic_failed_count->fetch_add(1, std::memory_order_relaxed);
                    }
                    
                    dispatch_semaphore_signal(sema);
                }
            });
        }

        dispatch_group_wait(group, DISPATCH_TIME_FOREVER);
        
        return batch_result;
    }
} 