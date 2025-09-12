#include <node_api.h>
#include <stdlib.h>
#include <string.h>
#include "ocr.h"

extern CGImageRef CreateCGImageFromPath(const char* path, char** error);
extern CGImageRef CreateCGImageFromBuffer(const void* buffer, size_t length, char** error);

typedef struct {
    napi_async_work work;
    napi_deferred deferred;
    char* image_path;
    OCROptions options;
    OCRResult* result;
    char* error_message;
} OCRWork;

typedef struct {
    napi_async_work work;
    napi_deferred deferred;
    char** image_paths;
    size_t count;
    OCRBatchOptions options;
    OCRBatchResult* result;
    char* error_message;
} BatchOCRWork;

typedef struct {
    napi_async_work work;
    napi_deferred deferred;
    void* buffer_data;
    size_t buffer_length;
    OCROptions options;
    OCRResult* result;
    char* error_message;
} OCRBufferWork;

typedef struct {
    napi_async_work work;
    napi_deferred deferred;
    void** buffer_data;
    size_t* buffer_lengths;
    size_t count;
    OCRBatchOptions options;
    OCRBatchResult* result;
    char* error_message;
} BatchBufferOCRWork;

void ExecuteOCR(napi_env env, void* data) {
    OCRWork* work = (OCRWork*)data;
    
    char* error = NULL;
    CGImageRef image = CreateCGImageFromPath(work->image_path, &error);
    
    if (!image) {
        if (error) {
            work->error_message = error;
            return;
        } else {
            work->error_message = strdup("Failed to create image from path");
            return;
        }
    }
    
    work->result = perform_ocr(image, &work->options);
    
    CGImageRelease(image);
}

void CompleteOCR(napi_env env, napi_status status, void* data) {
    OCRWork* work = (OCRWork*)data;
    
    if (work->error_message) {
        napi_value error, error_msg;
        napi_create_string_utf8(env, work->error_message, NAPI_AUTO_LENGTH, &error_msg);
        napi_create_error(env, NULL, error_msg, &error);
        napi_reject_deferred(env, work->deferred, error);
        free(work->error_message);
    }
    else if (work->result && work->result->error) {
        napi_value error, error_msg;
        napi_create_string_utf8(env, work->result->error, NAPI_AUTO_LENGTH, &error_msg);
        napi_create_error(env, NULL, error_msg, &error);
        napi_reject_deferred(env, work->deferred, error);
    }

    else if (work->result) {
        napi_value obj, text, confidence, observations;
        napi_create_object(env, &obj);

        if (work->result->text) {
            napi_create_string_utf8(env, work->result->text, NAPI_AUTO_LENGTH, &text);
            napi_set_named_property(env, obj, "text", text);
        } else {
            napi_get_null(env, &text);
            napi_set_named_property(env, obj, "text", text);
        }
        
        napi_create_double(env, work->result->confidence, &confidence);
        napi_set_named_property(env, obj, "confidence", confidence);
        
        // Add observations array
        if (work->result->observations && work->result->observation_count > 0) {
            napi_create_array_with_length(env, work->result->observation_count, &observations);
            for (size_t i = 0; i < work->result->observation_count; i++) {
                TextObservation* obs = &work->result->observations[i];
                napi_value obs_obj, obs_text, obs_confidence, obs_x, obs_y, obs_width, obs_height;
                
                napi_create_object(env, &obs_obj);
                napi_create_string_utf8(env, obs->text, NAPI_AUTO_LENGTH, &obs_text);
                napi_create_double(env, obs->confidence, &obs_confidence);
                napi_create_double(env, obs->x, &obs_x);
                napi_create_double(env, obs->y, &obs_y);
                napi_create_double(env, obs->width, &obs_width);
                napi_create_double(env, obs->height, &obs_height);
                
                napi_set_named_property(env, obs_obj, "text", obs_text);
                napi_set_named_property(env, obs_obj, "confidence", obs_confidence);
                napi_set_named_property(env, obs_obj, "x", obs_x);
                napi_set_named_property(env, obs_obj, "y", obs_y);
                napi_set_named_property(env, obs_obj, "width", obs_width);
                napi_set_named_property(env, obs_obj, "height", obs_height);
                
                napi_set_element(env, observations, i, obs_obj);
            }
        } else {
            napi_create_array_with_length(env, 0, &observations);
        }
        napi_set_named_property(env, obj, "observations", observations);
        
        napi_resolve_deferred(env, work->deferred, obj);
    }
    else {
        napi_value error, error_msg;
        napi_create_string_utf8(env, "Unknown error occurred", NAPI_AUTO_LENGTH, &error_msg);
        napi_create_error(env, NULL, error_msg, &error);
        napi_reject_deferred(env, work->deferred, error);
    }
    
    // 清理资源
    if (work->result) {
        free_ocr_result(work->result);
    }
    if (work->image_path) {
        free(work->image_path);
    }
    // 修复字符串比较
    if (work->options.languages && strcmp(work->options.languages, "en-US") != 0) {
        free((void*)work->options.languages);
    }
    napi_delete_async_work(env, work->work);
    free(work);
}

static bool GetOptionsFromObject(napi_env env, napi_value options, OCROptions* out_options) {

    out_options->languages = "en-US";
    out_options->recognition_level = OCR_RECOGNITION_LEVEL_ACCURATE;
    out_options->min_confidence = 0.0;
    
    if (options == NULL) {
        return true;
    }
    
    napi_value languages, recognition_level, min_confidence;
    
    // 获取语言设置
    if (napi_get_named_property(env, options, "languages", &languages) == napi_ok) {
        size_t lang_length;
        if (napi_get_value_string_utf8(env, languages, NULL, 0, &lang_length) == napi_ok) {
            char* langs = (char*)malloc(lang_length + 1);
            if (napi_get_value_string_utf8(env, languages, langs, lang_length + 1, NULL) == napi_ok) {
                out_options->languages = langs;
            } else {
                free(langs);
            }
        }
    }
    
    if (napi_get_named_property(env, options, "recognitionLevel", &recognition_level) == napi_ok) {
        int32_t level;
        if (napi_get_value_int32(env, recognition_level, &level) == napi_ok) {
            if (level != OCR_RECOGNITION_LEVEL_FAST && level != OCR_RECOGNITION_LEVEL_ACCURATE) {
                return false;
            }
            out_options->recognition_level = (OCRRecognitionLevel)level;
        }
    }
    
    if (napi_get_named_property(env, options, "minConfidence", &min_confidence) == napi_ok) {
        double conf;
        if (napi_get_value_double(env, min_confidence, &conf) == napi_ok) {
            out_options->min_confidence = conf;
        }
    }
    
    return true;
}

napi_value Recognize(napi_env env, napi_callback_info info) {
    size_t argc = 2;
    napi_value args[2];
    napi_get_cb_info(env, info, &argc, args, NULL, NULL);
    
    if (argc < 1) {
        napi_throw_error(env, NULL, "Wrong number of arguments");
        return NULL;
    }
    
    // Verify first argument is a string
    napi_valuetype valuetype;
    if (napi_typeof(env, args[0], &valuetype) != napi_ok || valuetype != napi_string) {
        napi_throw_type_error(env, NULL, "First argument must be a string");
        return NULL;
    }
    
    napi_value promise;
    napi_deferred deferred;
    napi_create_promise(env, &deferred, &promise);
    
    // Get image path with proper error checking
    size_t path_length;
    napi_status path_status = napi_get_value_string_utf8(env, args[0], NULL, 0, &path_length);
    if (path_status != napi_ok) {
        napi_throw_error(env, NULL, "Failed to get image path length");
        return NULL;
    }
    
    OCRWork* work = (OCRWork*)malloc(sizeof(OCRWork));
    if (!work) {
        napi_throw_error(env, NULL, "Failed to allocate memory");
        return NULL;
    }
    
    // Initialize work structure
    work->image_path = (char*)malloc(path_length + 1);
    work->deferred = deferred;
    work->result = NULL;
    work->error_message = NULL;
    
    if (!work->image_path) {
        free(work);
        napi_throw_error(env, NULL, "Failed to allocate memory for image path");
        return NULL;
    }
    
    // Get the actual path string with error checking
    if (napi_get_value_string_utf8(env, args[0], work->image_path, path_length + 1, NULL) != napi_ok) {
        free(work->image_path);
        free(work);
        napi_throw_error(env, NULL, "Failed to get image path");
        return NULL;
    }
    
    // Verify second argument is an object if provided
    if (argc > 1 && args[1] != NULL) {
        napi_valuetype optionsType;
        if (napi_typeof(env, args[1], &optionsType) != napi_ok || 
            (optionsType != napi_object && optionsType != napi_null && optionsType != napi_undefined)) {
            free(work->image_path);
            free(work);
            napi_throw_type_error(env, NULL, "Options argument must be an object");
            return NULL;
        }
    }
    
    // Get options
    if (argc > 1 && args[1] != NULL) {
        if (!GetOptionsFromObject(env, args[1], &work->options)) {
            free(work->image_path);
            free(work);
            napi_throw_error(env, NULL, "Invalid options");
            return NULL;
        }
    } else {
        // Use default options
        work->options = (OCROptions){
            .languages = "en-US",
            .recognition_level = OCR_RECOGNITION_LEVEL_ACCURATE,
            .min_confidence = 0.0,
        };
    }
    
    // Create async work
    napi_value resource_name;
    napi_create_string_utf8(env, "OCR", NAPI_AUTO_LENGTH, &resource_name);
    
    napi_status status = napi_create_async_work(env,
                                              NULL,
                                              resource_name,
                                              ExecuteOCR,
                                              CompleteOCR,
                                              work,
                                              &work->work);
    
    if (status != napi_ok) {
        if (work->options.languages && strcmp(work->options.languages, "en-US") != 0) {
            free((void*)work->options.languages);
        }
        free(work->image_path);
        free(work);
        napi_throw_error(env, NULL, "Failed to create async work");
        return NULL;
    }
    
    napi_queue_async_work(env, work->work);
    
    return promise;
}

void ExecuteBatchOCR(napi_env env, void* data) {
    BatchOCRWork* work = (BatchOCRWork*)data;
    work->result = perform_batch_ocr((const char**)work->image_paths, work->count, &work->options);
}

void CompleteBatchOCR(napi_env env, napi_status status, void* data) {
    BatchOCRWork* work = (BatchOCRWork*)data;
    
    
    
    if (work->error_message) {
        
        napi_value error, error_msg;
        napi_create_string_utf8(env, work->error_message, NAPI_AUTO_LENGTH, &error_msg);
        napi_create_error(env, NULL, error_msg, &error);
        napi_reject_deferred(env, work->deferred, error);
        free(work->error_message);
    }
    else if (work->result && work->result->error) {
        
        napi_value error, error_msg;
        napi_create_string_utf8(env, work->result->error, NAPI_AUTO_LENGTH, &error_msg);
        napi_create_error(env, NULL, error_msg, &error);
        napi_reject_deferred(env, work->deferred, error);
    }
    else if (work->result) {
        
        napi_value results_array;
        napi_create_array_with_length(env, work->result->count, &results_array);

        for (size_t i = 0; i < work->result->count; i++) {
            OCRResult* result = work->result->results[i];
            
            
            napi_value obj, text, confidence, observations;
            napi_create_object(env, &obj);

            if (result && result->text) {
                napi_create_string_utf8(env, result->text, NAPI_AUTO_LENGTH, &text);
            } else {
                napi_get_null(env, &text);
            }
            napi_set_named_property(env, obj, "text", text);

            if (result) {
                
                napi_create_double(env, result->confidence, &confidence);
            } else {
                napi_create_double(env, 0.0, &confidence);
            }
            napi_set_named_property(env, obj, "confidence", confidence);

            // Add observations array
            if (result && result->observations && result->observation_count > 0) {
                napi_create_array_with_length(env, result->observation_count, &observations);
                for (size_t j = 0; j < result->observation_count; j++) {
                    TextObservation* obs = &result->observations[j];
                    napi_value obs_obj, obs_text, obs_confidence, obs_x, obs_y, obs_width, obs_height;
                    
                    napi_create_object(env, &obs_obj);
                    napi_create_string_utf8(env, obs->text, NAPI_AUTO_LENGTH, &obs_text);
                    napi_create_double(env, obs->confidence, &obs_confidence);
                    napi_create_double(env, obs->x, &obs_x);
                    napi_create_double(env, obs->y, &obs_y);
                    napi_create_double(env, obs->width, &obs_width);
                    napi_create_double(env, obs->height, &obs_height);
                    
                    napi_set_named_property(env, obs_obj, "text", obs_text);
                    napi_set_named_property(env, obs_obj, "confidence", obs_confidence);
                    napi_set_named_property(env, obs_obj, "x", obs_x);
                    napi_set_named_property(env, obs_obj, "y", obs_y);
                    napi_set_named_property(env, obs_obj, "width", obs_width);
                    napi_set_named_property(env, obs_obj, "height", obs_height);
                    
                    napi_set_element(env, observations, j, obs_obj);
                }
            } else {
                napi_create_array_with_length(env, 0, &observations);
            }
            napi_set_named_property(env, obj, "observations", observations);

            napi_set_element(env, results_array, i, obj);
        }

        // 验证数组创建是否成功
        bool is_array;
        napi_is_array(env, results_array, &is_array);
        

        uint32_t length;
        napi_get_array_length(env, results_array, &length);
        

        napi_resolve_deferred(env, work->deferred, results_array);
    }
    else {
        
        napi_value error, error_msg;
        napi_create_string_utf8(env, "Unknown error occurred", NAPI_AUTO_LENGTH, &error_msg);
        napi_create_error(env, NULL, error_msg, &error);
        napi_reject_deferred(env, work->deferred, error);
    }
    
    // Cleanup
    if (work->result) {
        free_ocr_batch_result(work->result);
    }
    if (work->image_paths) {
        for (size_t i = 0; i < work->count; i++) {
            free(work->image_paths[i]);
        }
        free(work->image_paths);
    }
    if (work->options.ocr_options.languages && strcmp(work->options.ocr_options.languages, "en-US") != 0) {
        free((void*)work->options.ocr_options.languages);
    }
    napi_delete_async_work(env, work->work);
    free(work);
}

static bool GetBatchOptionsFromObject(napi_env env, napi_value options, OCRBatchOptions* out_options) {
    // Set default values
    out_options->ocr_options.languages = "en-US";
    out_options->ocr_options.recognition_level = OCR_RECOGNITION_LEVEL_ACCURATE;
    out_options->ocr_options.min_confidence = 0.0;
    out_options->max_threads = 0;
    out_options->batch_size = 1;
    
    if (options == NULL) {
        return true;
    }
    
    // Get OCR options
    napi_value ocr_options;
    if (napi_get_named_property(env, options, "ocrOptions", &ocr_options) == napi_ok) {
        if (!GetOptionsFromObject(env, ocr_options, &out_options->ocr_options)) {
            return false;
        }
    }
    
    // Get batch specific options
    napi_value max_threads, batch_size;
    
    if (napi_get_named_property(env, options, "maxThreads", &max_threads) == napi_ok) {
        int32_t threads;
        if (napi_get_value_int32(env, max_threads, &threads) == napi_ok) {
            out_options->max_threads = threads;
        }
    }
    
    if (napi_get_named_property(env, options, "batchSize", &batch_size) == napi_ok) {
        int32_t size;
        if (napi_get_value_int32(env, batch_size, &size) == napi_ok) {
            out_options->batch_size = size;
        }
    }
    
    return true;
}

napi_value RecognizeBatch(napi_env env, napi_callback_info info) {
    size_t argc = 2;
    napi_value args[2];
    napi_get_cb_info(env, info, &argc, args, NULL, NULL);
    
    if (argc < 1) {
        napi_throw_error(env, NULL, "Wrong number of arguments");
        return NULL;
    }
    
    napi_value promise;
    napi_deferred deferred;
    napi_create_promise(env, &deferred, &promise);
    
    // Get array of image paths
    bool is_array;
    if (napi_is_array(env, args[0], &is_array) != napi_ok || !is_array) {
        napi_throw_error(env, NULL, "First argument must be an array of image paths");
        return NULL;
    }
    
    uint32_t array_length;
    napi_get_array_length(env, args[0], &array_length);
    
    if (array_length == 0) {
        napi_throw_error(env, NULL, "Image paths array cannot be empty");
        return NULL;
    }
    
    BatchOCRWork* work = (BatchOCRWork*)malloc(sizeof(BatchOCRWork));
    if (!work) {
        napi_throw_error(env, NULL, "Failed to allocate memory");
        return NULL;
    }
    
    // Initialize work structure
    work->image_paths = (char**)malloc(sizeof(char*) * array_length);
    work->count = array_length;
    work->deferred = deferred;
    work->result = NULL;
    work->error_message = NULL;
    
    if (!work->image_paths) {
        free(work);
        napi_throw_error(env, NULL, "Failed to allocate memory for image paths");
        return NULL;
    }
    
    // Get all image paths
    for (uint32_t i = 0; i < array_length; i++) {
        napi_value element;
        napi_get_element(env, args[0], i, &element);
        
        size_t path_length;
        napi_get_value_string_utf8(env, element, NULL, 0, &path_length);
        
        work->image_paths[i] = (char*)malloc(path_length + 1);
        if (!work->image_paths[i]) {
            for (uint32_t j = 0; j < i; j++) {
                free(work->image_paths[j]);
            }
            free(work->image_paths);
            free(work);
            napi_throw_error(env, NULL, "Failed to allocate memory for image path");
            return NULL;
        }
        
        napi_get_value_string_utf8(env, element, work->image_paths[i], path_length + 1, NULL);
    }
    
    // Get options
    if (argc > 1) {
        if (!GetBatchOptionsFromObject(env, args[1], &work->options)) {
            for (uint32_t i = 0; i < array_length; i++) {
                free(work->image_paths[i]);
            }
            free(work->image_paths);
            free(work);
            napi_throw_error(env, NULL, "Invalid options");
            return NULL;
        }
    } else {
        work->options = (OCRBatchOptions){
            .ocr_options = (OCROptions){
                .languages = "en-US",
                .recognition_level = OCR_RECOGNITION_LEVEL_ACCURATE,
                .min_confidence = 0.0
            },
            .max_threads = 0,
            .batch_size = 1
        };
    }
    
    // Create async work
    napi_value resource_name;
    napi_create_string_utf8(env, "BatchOCR", NAPI_AUTO_LENGTH, &resource_name);
    
    napi_status status = napi_create_async_work(env,
                                              NULL,
                                              resource_name,
                                              ExecuteBatchOCR,
                                              CompleteBatchOCR,
                                              work,
                                              &work->work);
    
    if (status != napi_ok) {
        if (work->options.ocr_options.languages && strcmp(work->options.ocr_options.languages, "en-US") != 0) {
            free((void*)work->options.ocr_options.languages);
        }
        for (uint32_t i = 0; i < array_length; i++) {
            free(work->image_paths[i]);
        }
        free(work->image_paths);
        free(work);
        napi_throw_error(env, NULL, "Failed to create async work");
        return NULL;
    }
    
    napi_queue_async_work(env, work->work);
    
    return promise;
}

void ExecuteBufferOCR(napi_env env, void* data) {
    OCRBufferWork* work = (OCRBufferWork*)data;
    
    char* error = NULL;
    CGImageRef image = CreateCGImageFromBuffer(work->buffer_data, work->buffer_length, &error);
    
    if (!image) {
        if (error) {
            work->error_message = error;
            return;
        } else {
            work->error_message = strdup("Failed to create image from buffer");
            return;
        }
    }
    
    work->result = perform_ocr(image, &work->options);
    
    CGImageRelease(image);
}

void CompleteBufferOCR(napi_env env, napi_status status, void* data) {
    OCRBufferWork* work = (OCRBufferWork*)data;
    
    if (work->error_message) {
        napi_value error, error_msg;
        napi_create_string_utf8(env, work->error_message, NAPI_AUTO_LENGTH, &error_msg);
        if (strstr(work->error_message, "must be a Buffer") != NULL ||
            strstr(work->error_message, "argument type") != NULL) {
            napi_create_type_error(env, NULL, error_msg, &error);
        } else {
            napi_create_error(env, NULL, error_msg, &error);
        }
        napi_reject_deferred(env, work->deferred, error);
        free(work->error_message);
    }
    else if (work->result && work->result->error) {
        napi_value error, error_msg;
        napi_create_string_utf8(env, work->result->error, NAPI_AUTO_LENGTH, &error_msg);
        napi_create_error(env, NULL, error_msg, &error);
        napi_reject_deferred(env, work->deferred, error);
    }
    else if (work->result) {
        napi_value obj, text, confidence, observations;
        napi_create_object(env, &obj);

        if (work->result->text) {
            napi_create_string_utf8(env, work->result->text, NAPI_AUTO_LENGTH, &text);
            napi_set_named_property(env, obj, "text", text);
        } else {
            napi_get_null(env, &text);
            napi_set_named_property(env, obj, "text", text);
        }
        
        napi_create_double(env, work->result->confidence, &confidence);
        napi_set_named_property(env, obj, "confidence", confidence);
        
        // Add observations array
        if (work->result->observations && work->result->observation_count > 0) {
            napi_create_array_with_length(env, work->result->observation_count, &observations);
            for (size_t i = 0; i < work->result->observation_count; i++) {
                TextObservation* obs = &work->result->observations[i];
                napi_value obs_obj, obs_text, obs_confidence, obs_x, obs_y, obs_width, obs_height;
                
                napi_create_object(env, &obs_obj);
                napi_create_string_utf8(env, obs->text, NAPI_AUTO_LENGTH, &obs_text);
                napi_create_double(env, obs->confidence, &obs_confidence);
                napi_create_double(env, obs->x, &obs_x);
                napi_create_double(env, obs->y, &obs_y);
                napi_create_double(env, obs->width, &obs_width);
                napi_create_double(env, obs->height, &obs_height);
                
                napi_set_named_property(env, obs_obj, "text", obs_text);
                napi_set_named_property(env, obs_obj, "confidence", obs_confidence);
                napi_set_named_property(env, obs_obj, "x", obs_x);
                napi_set_named_property(env, obs_obj, "y", obs_y);
                napi_set_named_property(env, obs_obj, "width", obs_width);
                napi_set_named_property(env, obs_obj, "height", obs_height);
                
                napi_set_element(env, observations, i, obs_obj);
            }
        } else {
            napi_create_array_with_length(env, 0, &observations);
        }
        napi_set_named_property(env, obj, "observations", observations);
        
        napi_resolve_deferred(env, work->deferred, obj);
    }
    else {
        napi_value error, error_msg;
        napi_create_string_utf8(env, "Unknown error occurred", NAPI_AUTO_LENGTH, &error_msg);
        napi_create_error(env, NULL, error_msg, &error);
        napi_reject_deferred(env, work->deferred, error);
    }
    
    // 清理资源
    if (work->result) {
        free_ocr_result(work->result);
    }
    if (work->buffer_data) {
        free(work->buffer_data);
    }
    if (work->options.languages && strcmp(work->options.languages, "en-US") != 0) {
        free((void*)work->options.languages);
    }
    napi_delete_async_work(env, work->work);
    free(work);
}

napi_value RecognizeBuffer(napi_env env, napi_callback_info info) {
    size_t argc = 2;
    napi_value args[2];
    napi_get_cb_info(env, info, &argc, args, NULL, NULL);
    
    if (argc < 1) {
        napi_throw_type_error(env, NULL, "Wrong number of arguments");
        return NULL;
    }
    
    napi_value promise;
    napi_deferred deferred;
    napi_create_promise(env, &deferred, &promise);
    
    // Get buffer data
    void* buffer_data;
    size_t buffer_length;
    if (napi_get_buffer_info(env, args[0], &buffer_data, &buffer_length) != napi_ok) {
        napi_throw_type_error(env, NULL, "Failed to get buffer info");
        return NULL;
    }
    
    OCRBufferWork* work = (OCRBufferWork*)malloc(sizeof(OCRBufferWork));
    if (!work) {
        napi_throw_error(env, NULL, "Failed to allocate memory");
        return NULL;
    }
    
    // Copy buffer data
    work->buffer_data = malloc(buffer_length);
    if (!work->buffer_data) {
        free(work);
        napi_throw_error(env, NULL, "Failed to allocate memory for buffer");
        return NULL;
    }
    memcpy(work->buffer_data, buffer_data, buffer_length);
    work->buffer_length = buffer_length;
    work->deferred = deferred;
    work->result = NULL;
    work->error_message = NULL;
    
    // Verify second argument is an object if provided
    if (argc > 1 && args[1] != NULL) {
        napi_valuetype optionsType;
        if (napi_typeof(env, args[1], &optionsType) != napi_ok || 
            (optionsType != napi_object && optionsType != napi_null && optionsType != napi_undefined)) {
            free(work->buffer_data);
            free(work);
            napi_throw_type_error(env, NULL, "Options argument must be an object");
            return NULL;
        }
    }
    
    // Get options
    if (argc > 1 && args[1] != NULL) {
        if (!GetOptionsFromObject(env, args[1], &work->options)) {
            free(work->buffer_data);
            free(work);
            napi_throw_error(env, NULL, "Invalid options");
            return NULL;
        }
    } else {
        // Use default options
        work->options = (OCROptions){
            .languages = "en-US",
            .recognition_level = OCR_RECOGNITION_LEVEL_ACCURATE,
            .min_confidence = 0.0,
        };
    }
    
    // Create async work
    napi_value resource_name;
    napi_create_string_utf8(env, "BufferOCR", NAPI_AUTO_LENGTH, &resource_name);
    
    napi_status status = napi_create_async_work(env,
                                              NULL,
                                              resource_name,
                                              ExecuteBufferOCR,
                                              CompleteBufferOCR,
                                              work,
                                              &work->work);
    
    if (status != napi_ok) {
        if (work->options.languages && strcmp(work->options.languages, "en-US") != 0) {
            free((void*)work->options.languages);
        }
        free(work->buffer_data);
        free(work);
        napi_throw_error(env, NULL, "Failed to create async work");
        return NULL;
    }
    
    status = napi_queue_async_work(env, work->work);
    if (status != napi_ok) {
        if (work->options.languages && strcmp(work->options.languages, "en-US") != 0) {
            free((void*)work->options.languages);
        }
        napi_delete_async_work(env, work->work);
        free(work->buffer_data);
        free(work);
        napi_throw_error(env, NULL, "Failed to queue async work");
        return NULL;
    }
    
    return promise;
}

void ExecuteBatchBufferOCR(napi_env env, void* data) {
    BatchBufferOCRWork* work = (BatchBufferOCRWork*)data;
    work->result = perform_batch_ocr_from_buffers((const void**)work->buffer_data, work->buffer_lengths, work->count, &work->options);
}

void CompleteBatchBufferOCR(napi_env env, napi_status status, void* data) {
    BatchBufferOCRWork* work = (BatchBufferOCRWork*)data;
    
    if (work->error_message) {
        napi_value error, error_msg;
        napi_create_string_utf8(env, work->error_message, NAPI_AUTO_LENGTH, &error_msg);
        napi_create_error(env, NULL, error_msg, &error);
        napi_reject_deferred(env, work->deferred, error);
        free(work->error_message);
    }
    else if (work->result && work->result->error) {
        napi_value error, error_msg;
        napi_create_string_utf8(env, work->result->error, NAPI_AUTO_LENGTH, &error_msg);
        napi_create_error(env, NULL, error_msg, &error);
        napi_reject_deferred(env, work->deferred, error);
    }
    else if (work->result) {
        napi_value results_array;
        napi_create_array_with_length(env, work->result->count, &results_array);

        for (size_t i = 0; i < work->result->count; i++) {
            OCRResult* result = work->result->results[i];
            
            napi_value obj, text, confidence, observations;
            napi_create_object(env, &obj);

            if (result && result->text) {
                napi_create_string_utf8(env, result->text, NAPI_AUTO_LENGTH, &text);
            } else {
                napi_get_null(env, &text);
            }
            napi_set_named_property(env, obj, "text", text);

            if (result) {
                napi_create_double(env, result->confidence, &confidence);
            } else {
                napi_create_double(env, 0.0, &confidence);
            }
            napi_set_named_property(env, obj, "confidence", confidence);

            // Add observations array
            if (result && result->observations && result->observation_count > 0) {
                napi_create_array_with_length(env, result->observation_count, &observations);
                for (size_t j = 0; j < result->observation_count; j++) {
                    TextObservation* obs = &result->observations[j];
                    napi_value obs_obj, obs_text, obs_confidence, obs_x, obs_y, obs_width, obs_height;
                    
                    napi_create_object(env, &obs_obj);
                    napi_create_string_utf8(env, obs->text, NAPI_AUTO_LENGTH, &obs_text);
                    napi_create_double(env, obs->confidence, &obs_confidence);
                    napi_create_double(env, obs->x, &obs_x);
                    napi_create_double(env, obs->y, &obs_y);
                    napi_create_double(env, obs->width, &obs_width);
                    napi_create_double(env, obs->height, &obs_height);
                    
                    napi_set_named_property(env, obs_obj, "text", obs_text);
                    napi_set_named_property(env, obs_obj, "confidence", obs_confidence);
                    napi_set_named_property(env, obs_obj, "x", obs_x);
                    napi_set_named_property(env, obs_obj, "y", obs_y);
                    napi_set_named_property(env, obs_obj, "width", obs_width);
                    napi_set_named_property(env, obs_obj, "height", obs_height);
                    
                    napi_set_element(env, observations, j, obs_obj);
                }
            } else {
                napi_create_array_with_length(env, 0, &observations);
            }
            napi_set_named_property(env, obj, "observations", observations);

            napi_set_element(env, results_array, i, obj);
        }

        napi_resolve_deferred(env, work->deferred, results_array);
    }
    else {
        napi_value error, error_msg;
        napi_create_string_utf8(env, "Unknown error occurred", NAPI_AUTO_LENGTH, &error_msg);
        napi_create_error(env, NULL, error_msg, &error);
        napi_reject_deferred(env, work->deferred, error);
    }
    
    // Cleanup
    if (work->result) {
        free_ocr_batch_result(work->result);
    }
    if (work->buffer_data) {
        for (size_t i = 0; i < work->count; i++) {
            if (work->buffer_data[i]) {
                free(work->buffer_data[i]);
            }
        }
        free(work->buffer_data);
    }
    if (work->buffer_lengths) {
        free(work->buffer_lengths);
    }
    if (work->options.ocr_options.languages && strcmp(work->options.ocr_options.languages, "en-US") != 0) {
        free((void*)work->options.ocr_options.languages);
    }
    napi_delete_async_work(env, work->work);
    free(work);
}

napi_value RecognizeBatchFromBuffer(napi_env env, napi_callback_info info) {
    size_t argc = 2;
    napi_value args[2];
    napi_get_cb_info(env, info, &argc, args, NULL, NULL);
    
    if (argc < 1) {
        napi_throw_error(env, NULL, "Wrong number of arguments");
        return NULL;
    }
    
    napi_value promise;
    napi_deferred deferred;
    napi_create_promise(env, &deferred, &promise);
    
    // Get array of buffers
    bool is_array;
    if (napi_is_array(env, args[0], &is_array) != napi_ok || !is_array) {
        napi_throw_error(env, NULL, "First argument must be an array of buffers");
        return NULL;
    }
    
    uint32_t array_length;
    napi_get_array_length(env, args[0], &array_length);
    
    if (array_length == 0) {
        napi_throw_error(env, NULL, "Buffer array cannot be empty");
        return NULL;
    }
    
    BatchBufferOCRWork* work = (BatchBufferOCRWork*)malloc(sizeof(BatchBufferOCRWork));
    if (!work) {
        napi_throw_error(env, NULL, "Failed to allocate memory");
        return NULL;
    }
    
    // Initialize work structure
    work->buffer_data = (void**)malloc(sizeof(void*) * array_length);
    work->buffer_lengths = (size_t*)malloc(sizeof(size_t) * array_length);
    work->count = array_length;
    work->deferred = deferred;
    work->result = NULL;
    work->error_message = NULL;
    
    if (!work->buffer_data || !work->buffer_lengths) {
        if (work->buffer_data) free(work->buffer_data);
        if (work->buffer_lengths) free(work->buffer_lengths);
        free(work);
        napi_throw_error(env, NULL, "Failed to allocate memory for buffers");
        return NULL;
    }
    
    // Get all buffers
    for (uint32_t i = 0; i < array_length; i++) {
        napi_value element;
        napi_get_element(env, args[0], i, &element);
        
        void* buffer_data;
        size_t buffer_length;
        if (napi_get_buffer_info(env, element, &buffer_data, &buffer_length) != napi_ok) {
            for (uint32_t j = 0; j < i; j++) {
                free(work->buffer_data[j]);
            }
            free(work->buffer_data);
            free(work->buffer_lengths);
            free(work);
            napi_throw_type_error(env, NULL, "Array elements must be Buffer or Uint8Array");
            return NULL;
        }
        
        work->buffer_data[i] = malloc(buffer_length);
        if (!work->buffer_data[i]) {
            for (uint32_t j = 0; j < i; j++) {
                free(work->buffer_data[j]);
            }
            free(work->buffer_data);
            free(work->buffer_lengths);
            free(work);
            napi_throw_error(env, NULL, "Failed to allocate memory for buffer");
            return NULL;
        }
        
        memcpy(work->buffer_data[i], buffer_data, buffer_length);
        work->buffer_lengths[i] = buffer_length;
    }
    
    // Get options
    if (argc > 1) {
        if (!GetBatchOptionsFromObject(env, args[1], &work->options)) {
            for (uint32_t i = 0; i < array_length; i++) {
                free(work->buffer_data[i]);
            }
            free(work->buffer_data);
            free(work->buffer_lengths);
            free(work);
            napi_throw_error(env, NULL, "Invalid options");
            return NULL;
        }
    } else {
        work->options = (OCRBatchOptions){
            .ocr_options = (OCROptions){
                .languages = "en-US",
                .recognition_level = OCR_RECOGNITION_LEVEL_ACCURATE,
                .min_confidence = 0.0
            },
            .max_threads = 0,
            .batch_size = 1
        };
    }
    
    // Create async work
    napi_value resource_name;
    napi_create_string_utf8(env, "BatchBufferOCR", NAPI_AUTO_LENGTH, &resource_name);
    
    napi_status status = napi_create_async_work(env,
                                              NULL,
                                              resource_name,
                                              ExecuteBatchBufferOCR,
                                              CompleteBatchBufferOCR,
                                              work,
                                              &work->work);
    
    if (status != napi_ok) {
        if (work->options.ocr_options.languages && strcmp(work->options.ocr_options.languages, "en-US") != 0) {
            free((void*)work->options.ocr_options.languages);
        }
        for (uint32_t i = 0; i < array_length; i++) {
            free(work->buffer_data[i]);
        }
        free(work->buffer_data);
        free(work->buffer_lengths);
        free(work);
        napi_throw_error(env, NULL, "Failed to create async work");
        return NULL;
    }
    
    napi_queue_async_work(env, work->work);
    
    return promise;
}

napi_value Init(napi_env env, napi_value exports) {
    napi_value recognize_fn;
    napi_create_function(env, NULL, 0, Recognize, NULL, &recognize_fn);
    napi_set_named_property(env, exports, "recognize", recognize_fn);
    
    napi_value recognize_buffer_fn;
    napi_create_function(env, NULL, 0, RecognizeBuffer, NULL, &recognize_buffer_fn);
    napi_set_named_property(env, exports, "recognizeBuffer", recognize_buffer_fn);
    
    napi_value recognize_batch_fn;
    napi_create_function(env, NULL, 0, RecognizeBatch, NULL, &recognize_batch_fn);
    napi_set_named_property(env, exports, "recognizeBatch", recognize_batch_fn);
    
    napi_value recognize_batch_buffer_fn;
    napi_create_function(env, NULL, 0, RecognizeBatchFromBuffer, NULL, &recognize_batch_buffer_fn);
    napi_set_named_property(env, exports, "recognizeBatchFromBuffer", recognize_batch_buffer_fn);
    
    return exports;
}

NAPI_MODULE(NODE_GYP_MODULE_NAME, Init) 