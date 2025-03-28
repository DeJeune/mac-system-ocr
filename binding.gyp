{
    "targets": [{
        "target_name": "mac_system_ocr",
        "sources": [
            "lib/binding.c",
            "lib/ocr.mm"
        ],
        "include_dirs": [
            "<!@(node -p \"require('node-api-headers').include\")"
        ],
        "xcode_settings": {
            "MACOSX_DEPLOYMENT_TARGET": "10.15",
            "CLANG_ENABLE_OBJC_ARC": "YES",
            "OTHER_CFLAGS": [
                "-ObjC++"
            ],
            "OTHER_LDFLAGS": [
                "-framework Vision",
                "-framework Foundation"
            ]
        }
    }]
}
