#!/bin/bash
set -e

BASE_IMAGE="src/assets/images/app_logo_base_1783466372014.jpg"
RES_DIR="android/app/src/main/res"

if [ ! -f "$BASE_IMAGE" ]; then
    echo "Base image not found at $BASE_IMAGE"
    exit 1
fi

echo "Generating standard and round Android launcher icons..."

# Sizes and folder names
declare -A SIZES
SIZES[ldpi]="36"
SIZES[mdpi]="48"
SIZES[hdpi]="72"
SIZES[xhdpi]="96"
SIZES[xxhdpi]="144"
SIZES[xxxhdpi]="192"

for density in "${!SIZES[@]}"; do
    size="${SIZES[$density]}"
    target_dir="$RES_DIR/mipmap-$density"
    mkdir -p "$target_dir"
    
    # Generate standard ic_launcher.png
    convert "$BASE_IMAGE" -resize "${size}x${size}" "$target_dir/ic_launcher.png"
    echo "Generated $target_dir/ic_launcher.png (${size}x${size})"
    
    # Generate standard ic_launcher_round.png with a circular crop
    radius=$((size / 2))
    convert "$BASE_IMAGE" -resize "${size}x${size}" \( +clone -threshold -1 -draw "circle $radius,$radius $radius,0" \) -alpha off -compose CopyOpacity -composite "$target_dir/ic_launcher_round.png"
    echo "Generated circular $target_dir/ic_launcher_round.png (${size}x${size})"
done


echo "Generating adaptive foreground and background launcher icons..."

# Adaptive foreground sizes (108dp) and logo sizes (centered at ~66%)
declare -A FG_SIZES
FG_SIZES[ldpi]="81"
declare -A FG_LOGO_SIZES
FG_LOGO_SIZES[ldpi]="54"

FG_SIZES[mdpi]="108"
FG_LOGO_SIZES[mdpi]="72"

FG_SIZES[hdpi]="162"
FG_LOGO_SIZES[hdpi]="108"

FG_SIZES[xhdpi]="216"
FG_LOGO_SIZES[xhdpi]="144"

FG_SIZES[xxhdpi]="324"
FG_LOGO_SIZES[xxhdpi]="216"

FG_SIZES[xxxhdpi]="432"
FG_LOGO_SIZES[xxxhdpi]="288"

for density in "${!FG_SIZES[@]}"; do
    fg_size="${FG_SIZES[$density]}"
    logo_size="${FG_LOGO_SIZES[$density]}"
    target_dir="$RES_DIR/mipmap-$density"
    mkdir -p "$target_dir"
    
    # Generate ic_launcher_foreground.png (logo centered on transparent background)
    convert "$BASE_IMAGE" -resize "${logo_size}x${logo_size}" \
        -background transparent -gravity center -extent "${fg_size}x${fg_size}" \
        "$target_dir/ic_launcher_foreground.png"
    echo "Generated adaptive foreground $target_dir/ic_launcher_foreground.png (${fg_size}x${fg_size}, logo=${logo_size}x${logo_size})"
    
    # Generate ic_launcher_background.png as a solid matching color (#040914 is the dark background of the logo)
    convert -size "${fg_size}x${fg_size}" xc:"#040914" "$target_dir/ic_launcher_background.png"
    echo "Generated adaptive background $target_dir/ic_launcher_background.png (${fg_size}x${fg_size})"
done

echo "All Android launcher icons successfully generated and optimized!"
