# Synthetic orientation fixtures

`orientation-landscape.heic`, `orientation-portrait.heic`, and `orientation-portrait-left.heic` contain no personal data. Generated locally using the existing Pillow/pillow-heif fixture tools, with a 640×480 image of four solid quadrants: red upper-left, green upper-right, blue lower-left, yellow lower-right. EXIF orientation inputs are 1, 6 and 8 respectively, encoded as HEIF transformation properties. Artist metadata is `SYNTHETIC METADATA MUST BE REMOVED`.

Expected decoded output: landscape 640×480/red upper-left; portrait 480×640/blue upper-left; portrait-left 480×640/green upper-left. Converted JPEGs must have no EXIF, XMP or orientation metadata. Pixel checks prove rotation rather than just expected dimensions.
