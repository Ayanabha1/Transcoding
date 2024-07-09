#!/bin/bash

input_path=$1
output_path=$2

mkdir -p "${output_path}"

ffmpeg -i "$input_path" \
-vf scale=1280:720 \
-c:a aac -b:a 128k \
-c:v h264 -b:v 2M \
-profile:v main -level 3.1 \
-preset veryfast \
-g 48 \
-hls_time 6 \
-hls_list_size 0 \
-hls_segment_filename "$output_path"/720p_%03d.ts "$output_path"/720p.m3u8

exit