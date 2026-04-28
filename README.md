# VegeMap — NSW Vegetation Classifier

> **UTS 42028 Deep Learning**

A browser-based, zero-dependency tool that guides you through a complete **five-step pipeline** to classify NSW vegetation from aerial imagery and LiDAR point clouds, producing outputs aligned with the NSW State Vegetation Type Map (SVTM).

---

## Table of Contents

- [Overview](#overview)
- [Features](#features)
- [Classification Classes](#classification-classes)
- [Tech Stack](#tech-stack)
- [Getting Started](#getting-started)
  - [Option 1 — Download & Open (Quickest)](#option-1--download--open-quickest)
  - [Option 2 — Clone with Git](#option-2--clone-with-git)
  - [Option 3 — Run with a Local Server (Recommended)](#option-3--run-with-a-local-server-recommended)
- [Usage Walkthrough](#usage-walkthrough)
  - [Step 1 · Aerial Image Upload](#step-1--aerial-image-upload)
  - [Step 2 · LiDAR Ordering](#step-2--lidar-ordering)
  - [Step 3 · LiDAR Archive Upload](#step-3--lidar-archive-upload)
  - [Step 4 · Classifier Configuration](#step-4--classifier-configuration)
  - [Step 5 · Results & Exports](#step-5--results--exports)
- [Supported File Formats](#supported-file-formats)
- [Outputs](#outputs)
- [Project Structure](#project-structure)

---

## Overview

VegeMap processes georeferenced aerial imagery alongside LiDAR-derived structural data to classify vegetation across NSW study areas. The pipeline runs entirely in the browser, no installation, no server, no dependencies to install.

The classifier maps each pixel to one of **17 SVTM vegetation formations** using a **U-Net + ResNet-50** deep learning architecture, applying morphological post-processing, confidence thresholding, and tile stitching before producing export-ready geospatial outputs.

---

## Features

| Feature | Detail |
|---|---|
| GeoTIFF parsing | In-browser CRS detection, bounding box extraction, band validation |
| Bounding box export | Auto-converts projection to GDA2020 decimal degrees for ELVIS ordering |
| LiDAR processing | Canopy Height Model generation, strata fractions, TWI computation |
| Configurable resolution | 0.5 m/px · 1.0 m/px (default) · 2.0 m/px output |
| Soil data integration | Auto-fetched from the NSW SEED portal or manual upload |
| Classification map | Interactive zoom, RGB overlay toggle, SVTM colour-coded legend |
| Multi-format export | GeoTIFF · Shapefile · Confidence map · PDF report |

---

## Classification Classes

The classifier recognises **17 NSW SVTM vegetation formations**:

| # | Formation |
|---|---|
| 1 | Alpine Complex |
| 2 | Arid Shrublands (Acacia) |
| 3 | Arid Shrublands (Chenopod) |
| 4 | Dry Sclerophyll Forests (Shrub/grass) |
| 5 | Dry Sclerophyll Forests (Shrubby) |
| 6 | Forested Wetlands |
| 7 | Freshwater Wetlands |
| 8 | Grasslands |
| 9 | Grassy Woodlands |
| 10 | Heathlands |
| 11 | Rainforests |
| 12 | Saline Wetlands |
| 13 | Semi-arid Woodlands (Grassy) |
| 14 | Semi-arid Woodlands (Shrubby) |
| 15 | Wet Sclerophyll Forests (Grassy) |
| 16 | Wet Sclerophyll Forests (Shrubby) |
| 17 | Not classified |

---

## Tech Stack

- **HTML5** — structure and UI
- **CSS3** — layout, animations, dark theme (no framework)
- **Vanilla JavaScript (ES2020)** — all application logic
- **[GeoTIFF.js v2](https://geotiffjs.github.io/)** — GeoTIFF parsing (loaded via CDN, no install needed)

> No Node.js, no build step, no package manager required.

---

## Getting Started

### Option 1 — Download & Open (Quickest)

1. Go to the repository page on GitHub.
2. Click the green **Code** button → **Download ZIP**.
3. Extract the ZIP to any folder on your computer.
4. Open `index.html` directly in your browser.

> **Note:** Some browsers (Chrome, Edge) restrict local file access for security reasons. If the aerial image preview doesn't render, use Option 3 below.

---

### Option 2 — Clone with Git

```bash
git clone https://github.com/<your-username>/nswVegetationClassifier.git
cd nswVegetationClassifier
```

Then open `index.html` in your browser. Same caveat as Option 1 applies.

---

### Option 3 — Run with a Local Server (Recommended)

Running through a local HTTP server avoids all browser file-access restrictions and ensures GeoTIFF previews render correctly.

**Using Python (built into macOS / Linux):**

```bash
cd nswVegetationClassifier
python3 -m http.server 8080
```

Then visit [http://localhost:8080](http://localhost:8080) in your browser.

**Using Node.js (`npx serve`):**

```bash
cd nswVegetationClassifier
npx serve .
```

## Usage Walkthrough

### Step 1 · Aerial Image Upload

Upload a georeferenced aerial image of your NSW study area.

- **Drag and drop** the file onto the upload zone, or click **Browse Files**.
- The app validates the file format, coordinate reference system (CRS), georeference metadata, and RGB band structure.
- A live preview of the image is rendered along with spatial statistics (dimensions, ground resolution, CRS code).
- Once validated, click **Continue to LiDAR Order**.

**Accepted formats:** GeoTIFF (`.tif`, `.tiff`), ECW (`.ecw`), JPEG 2000 (`.jp2`), ERDAS IMAGINE (`.img`)

---

### Step 2 · LiDAR Ordering

The app extracts the bounding box of your study area and displays it in **GDA2020 decimal degrees**. You will use this to order matching LiDAR tiles from the ELVIS portal.

1. Click **Copy Coordinates** to copy your bounding box to the clipboard.
2. Click **Open ELVIS Portal** to visit [elevation.fsdf.org.au](https://elevation.fsdf.org.au).
3. Click **Order Data** in the ELVIS navigation bar.
4. Paste the bounding box coordinates and select **Point Cloud** (LAS / LAZ format).
5. Complete the order — a download link arrives by email within 24–48 hours.
6. Return to the app and click **I've received my LiDAR archive** to proceed.

---

### Step 3 · LiDAR Archive Upload

Upload the `.zip` archive received from ELVIS.

- The app extracts the archive, verifies the spatial extent against your aerial image, and processes the LAS/LAZ files.
- A **Canopy Height Model (CHM)** preview is generated with colour-coded height gradients.
- Processing stages shown: archive extraction → spatial verification → CHM generation → strata fractions & TWI → finalising LiDAR bands.
- Once complete, click **Continue to Configuration**.

---

### Step 4 · Classifier Configuration

Tune the classification before running inference.

| Setting | Options |
|---|---|
| Output Resolution | 0.5 m/px (high detail) · **1.0 m/px (default)** · 2.0 m/px (fast) |
| Soil Data Source | **Auto** (fetched from NSW SEED portal) · Manual upload |

Click **Run Classification** to start.

---

### Step 5 · Results & Exports

The pipeline runs four stages with a live progress bar:

1. **Pre-processing** — band normalisation, CHM alignment, soil raster resampling
2. **Tiling** — slicing the scene into 512 × 512 pixel tiles with overlap
3. **Model Inference** — U-Net + ResNet-50 forward pass across all tiles
4. **Post-processing** — morphological cleanup, confidence thresholding, tile stitching

On completion, the **Vegetation Classification Map** is displayed with:
- Interactive zoom controls
- RGB overlay toggle
- SVTM colour-coded legend
- Summary statistics: area classified (ha), classes detected, mean confidence (%), processing time (s)

---

## Supported File Formats

| Input | Formats |
|---|---|
| Aerial image | `.tif` / `.tiff` (GeoTIFF), `.ecw`, `.jp2`, `.img` |
| LiDAR archive | `.zip` containing `.las` or `.laz` tiles |

---

## Outputs

| Export | Format | Description |
|---|---|---|
| Classification Raster | GeoTIFF (`.tif`) | Per-pixel SVTM class labels |
| Vector Polygons | Shapefile (`.zip`) | Vectorised formation boundaries |
| Confidence Map | PNG (`.png`) | Per-pixel confidence scores |
| Summary Report | PDF (`.pdf`) | Area statistics and metadata |

---

## Project Structure

```
nswVegetationClassifier/
├── index.html      # App shell — all five step panels and UI markup
├── styles.css      # Dark-themed component styles and animations
└── app.js          # All application logic — file handling, processing, rendering
```

---

*UTS Faculty of Engineering and IT · 42028 Deep Learning and Convolutional Neural Networks · Semester 1, 2025*
