cmake_minimum_required(VERSION 3.15)
project(cs2_proximity_plugin)

set(CMAKE_CXX_STANDARD 17)

add_library(cs2_proximity_plugin SHARED plugin.cpp)

target_include_directories(cs2_proximity_plugin PRIVATE
    ${CMAKE_SOURCE_DIR}/ts3
    ${CMAKE_SOURCE_DIR}/external
)

# Output settings
set_target_properties(cs2_proximity_plugin PROPERTIES
    OUTPUT_NAME "cs2_proximity_plugin"
    PREFIX ""
)

# Link .def file (FIXED)
set_target_properties(cs2_proximity_plugin PROPERTIES
    LINK_FLAGS "/DEF:\"${CMAKE_SOURCE_DIR}/plugin.def\""
)