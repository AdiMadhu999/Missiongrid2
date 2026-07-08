#!/bin/bash
set -e

BASE_IMAGE="src/assets/images/app_logo_base_1783466372014.jpg"
RES_DIR="android/app/src/main/res"

if [ ! -f "$BASE_IMAGE" ]; then
    echo "Base image not found at $BASE_IMAGE"
    exit 1
fi

echo "Generating Android splash screens..."

# Function to generate a centered splash screen
# Arguments: target_file, width, height, logo_size
generate_splash() {
    local target_file="$1"
    local width="$2"
    local height="$3"
    local logo_size="$4"
    local target_dir
    target_dir=$(dirname "$target_file")
    
    mkdir -p "$target_dir"
    
    # Create the centered splash screen
    convert "$BASE_IMAGE" -resize "${logo_size}x${logo_size}" \
        -background "#040914" -gravity center -extent "${width}x${height}" \
        "$target_file"
        
    echo "Generated $target_file (${width}x${height}, logo=${logo_size}x${logo_size})"
}

# Define splash densities and dimensions
# Density: Width, Height, LogoSize
# Portrait:
declare -A PORT_WIDTHS
PORT_WIDTHS[ldpi]="200"
PORT_WIDTHS[mdpi]="320"
PORT_WIDTHS[hdpi]="480"
PORT_WIDTHS[xhdpi]="720"
PORT_WIDTHS[xxhdpi]="960"
PORT_WIDTHS[xxxhdpi]="1280"

declare -A PORT_HEIGHTS
PORT_HEIGHTS[ldpi]="320"
PORT_HEIGHTS[mdpi]="480"
PORT_HEIGHTS[hdpi]="800"
PORT_HEIGHTS[xhdpi]="1280"
PORT_HEIGHTS[xxhdpi]="1600"
PORT_HEIGHTS[xxxhdpi]="1920"

declare -A PORT_LOGOS
PORT_LOGOS[ldpi]="80"
PORT_LOGOS[mdpi]="128"
PORT_LOGOS[hdpi]="192"
PORT_LOGOS[xhdpi]="288"
PORT_LOGOS[xxhdpi]="384"
PORT_LOGOS[xxxhdpi]="512"

# Landscape:
declare -A LAND_WIDTHS
LAND_WIDTHS[ldpi]="320"
LAND_WIDTHS[mdpi]="480"
LAND_WIDTHS[hdpi]="800"
LAND_WIDTHS[xhdpi]="1280"
LAND_WIDTHS[xxhdpi]="1600"
LAND_WIDTHS[xxxhdpi]="1920"

declare -A LAND_HEIGHTS
LAND_HEIGHTS[ldpi]="200"
LAND_HEIGHTS[mdpi]="320"
LAND_HEIGHTS[hdpi]="480"
LAND_HEIGHTS[xhdpi]="720"
LAND_HEIGHTS[xxhdpi]="960"
LAND_HEIGHTS[xxxhdpi]="1280"

declare -A LAND_LOGOS
LAND_LOGOS[ldpi]="80"
LAND_LOGOS[mdpi]="128"
LAND_LOGOS[hdpi]="192"
LAND_LOGOS[xhdpi]="288"
LAND_LOGOS[xxhdpi]="384"
LAND_LOGOS[xxxhdpi]="512"

# 1. Generate Portrait Splashes (Standard and Night versions)
for density in "${!PORT_WIDTHS[@]}"; do
    w="${PORT_WIDTHS[$density]}"
    h="${PORT_HEIGHTS[$density]}"
    logo="${PORT_LOGOS[$density]}"
    
    # Standard Portrait
    generate_splash "$RES_DIR/drawable-port-$density/splash.png" "$w" "$h" "$logo"
    
    # Night Portrait
    generate_splash "$RES_DIR/drawable-port-night-$density/splash.png" "$w" "$h" "$logo"
done

# 2. Generate Landscape Splashes (Standard and Night versions)
for density in "${!LAND_WIDTHS[@]}"; do
    w="${LAND_WIDTHS[$density]}"
    h="${LAND_HEIGHTS[$density]}"
    logo="${LAND_LOGOS[$density]}"
    
    # Standard Landscape
    generate_splash "$RES_DIR/drawable-land-$density/splash.png" "$w" "$h" "$logo"
    
    # Night Landscape
    generate_splash "$RES_DIR/drawable-land-night-$density/splash.png" "$w" "$h" "$logo"
done

# 3. Generate Fallback Splashes
# Default splash in drawable/
generate_splash "$RES_DIR/drawable/splash.png" "720" "1280" "288"
# Default night splash in drawable-night/
generate_splash "$RES_DIR/drawable-night/splash.png" "720" "1280" "288"

echo "All Android splash screens successfully generated and optimized!"
