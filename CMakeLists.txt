cmake_minimum_required(VERSION 3.15)

project(mac_system_ocr)

add_compile_definitions(-DNAPI_VERSION=4)

set(CMAKE_OSX_DEPLOYMENT_TARGET "10.15")

file(GLOB SOURCE_FILES
    "lib/binding.c"
    "lib/ocr.mm"
)

add_library(${PROJECT_NAME} SHARED ${SOURCE_FILES} ${CMAKE_JS_SRC})

set_target_properties(${PROJECT_NAME} PROPERTIES
    PREFIX ""
    SUFFIX ".node"
)

target_include_directories(${PROJECT_NAME} PRIVATE ${CMAKE_JS_INC})

target_link_libraries(${PROJECT_NAME} PRIVATE ${CMAKE_JS_LIB})

target_compile_features(${PROJECT_NAME} PRIVATE cxx_std_17)

target_link_libraries(${PROJECT_NAME} PRIVATE
    "-framework Vision"
    "-framework Foundation"
)

set_source_files_properties(lib/binding.c PROPERTIES
    COMPILE_FLAGS "-ObjC++"
    LANGUAGE C
)

set_source_files_properties(lib/ocr.mm PROPERTIES
    COMPILE_FLAGS "-fobjc-arc -ObjC++"
    LANGUAGE CXX
)
