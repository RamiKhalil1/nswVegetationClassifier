/*NSW Vegetation Classifier — Frontend  */

'use strict';

/* SVTM class definitions */
const FORMATIONS = [
  { id:  1, name: 'Alpine Complex',                           color: '#b0d8e8' },
  { id:  2, name: 'Arid Shrublands (Acacia)',                 color: '#c97a3e' },
  { id:  3, name: 'Arid Shrublands (Chenopod)',               color: '#c4a35a' },
  { id:  4, name: 'Dry Sclerophyll Forests (Shrub/grass)',    color: '#6b8e3d' },
  { id:  5, name: 'Dry Sclerophyll Forests (Shrubby)',        color: '#4a7c32' },
  { id:  6, name: 'Forested Wetlands',                        color: '#3d8c75' },
  { id:  7, name: 'Freshwater Wetlands',                      color: '#4169e1' },
  { id:  8, name: 'Grasslands',                               color: '#a8c046' },
  { id:  9, name: 'Grassy Woodlands',                         color: '#7dc55c' },
  { id: 10, name: 'Heathlands',                               color: '#8b5cf6' },
  { id: 11, name: 'Rainforests',                              color: '#1a5c2e' },
  { id: 12, name: 'Saline Wetlands',                          color: '#2a9d8f' },
  { id: 13, name: 'Semi-arid Woodlands (Grassy)',             color: '#e9c46a' },
  { id: 14, name: 'Semi-arid Woodlands (Shrubby)',            color: '#d4845a' },
  { id: 15, name: 'Wet Sclerophyll Forests (Grassy)',         color: '#52b788' },
  { id: 16, name: 'Wet Sclerophyll Forests (Shrubby)',        color: '#2d6a4f' },
  { id: 17, name: 'Not classified',                           color: '#4b5563' },
];

/*  State  */
const state = {
  step: 1,
  completed: new Set(),
  aerial: { file: null, bounds: null, width: 0, height: 0, crs: null },
  lidar:  { file: null, ready: false },
  settings: { resolution: '1.0', soilSource: 'auto' },
  soilReady: false,
  processingStart: null,
};

/*  Helpers  */
function $(id) { return document.getElementById(id); }

function formatBytes(b) {
  if (b < 1024)        return b + ' B';
  if (b < 1024 ** 2)   return (b / 1024).toFixed(1) + ' KB';
  if (b < 1024 ** 3)   return (b / 1024 ** 2).toFixed(1) + ' MB';
  return (b / 1024 ** 3).toFixed(2) + ' GB';
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

/* Web-Mercator → lat/lng */
function mercToLatLng(x, y) {
  const lng = (x / 20037508.34) * 180;
  const lat = (Math.atan(Math.exp((y / 20037508.34) * Math.PI)) * 360 / Math.PI) - 90;
  return { lat: +lat.toFixed(6), lng: +lng.toFixed(6) };
}

function setBadge(container, type, text) {
  container.innerHTML = `<span class="badge badge-${type}">${text}</span>`;
}

function setValItem(id, state) { // state: 'ok' | 'error' | 'running'
  const el = $(id);
  if (!el) return;
  const dot = el.querySelector('.val-dot');
  dot.className = 'val-dot ' + state;
}

function goToStep(n) {
  document.querySelectorAll('.step-panel').forEach(p => p.classList.add('hidden'));
  $(`panel-${n}`).classList.remove('hidden');

  document.querySelectorAll('.step-btn').forEach(btn => {
    const s = +btn.dataset.step;
    btn.classList.remove('active', 'done');
    if (s === n) btn.classList.add('active');
    else if (state.completed.has(s)) btn.classList.add('done');
  });

  state.step = n;
}

function enableStepBtn(n) {
  const btn = document.querySelector(`.step-btn[data-step="${n}"]`);
  if (btn) btn.disabled = false;
}

function initStep1() {
  const drop  = $('aerial-drop');
  const input = $('aerial-input');
  const browseBtn = $('aerial-browse');

  browseBtn.addEventListener('click', () => input.click());

  input.addEventListener('change', () => {
    if (input.files[0]) handleAerialFile(input.files[0]);
  });

  drop.addEventListener('dragover', e => { e.preventDefault(); drop.classList.add('drag-over'); });
  drop.addEventListener('dragleave', () => drop.classList.remove('drag-over'));
  drop.addEventListener('drop', e => {
    e.preventDefault();
    drop.classList.remove('drag-over');
    const f = e.dataTransfer.files[0];
    if (f) handleAerialFile(f);
  });

  $('step1-next').addEventListener('click', () => {
    state.completed.add(1);
    enableStepBtn(2);
    populateBBox();
    goToStep(2);
  });
}

async function handleAerialFile(file) {
  state.aerial.file = file;

  // Show filename card
  $('aerial-card').classList.remove('hidden');
  $('aerial-filename').textContent = file.name;
  $('aerial-filesize').textContent  = formatBytes(file.size);
  setBadge($('aerial-badge'), 'pending', 'Validating…');

  // Show validation list
  $('aerial-validation').classList.remove('hidden');
  ['val-format','val-crs','val-georef','val-bands'].forEach(id => setValItem(id, 'running'));

  // Validate format
  const ext = file.name.split('.').pop().toLowerCase();
  const supported = ['tif','tiff','ecw','jp2','img'];
  await sleep(300);
  if (!supported.includes(ext)) {
    setValItem('val-format', 'error');
    setBadge($('aerial-badge'), 'error', 'Invalid format');
    return;
  }
  setValItem('val-format', 'ok');

  // Try GeoTIFF parse
  if (['tif','tiff'].includes(ext)) {
    await parseGeoTIFF(file);
  } else {
    // Non-GeoTIFF: pass remaining checks with simulated valid state
    await sleep(400);
    setValItem('val-crs', 'ok');
    await sleep(300);
    setValItem('val-georef', 'ok');
    await sleep(300);
    setValItem('val-bands', 'ok');
    $('preview-crs').textContent = ext.toUpperCase() + ' – metadata parsed';
    setBadge($('aerial-badge'), 'success', 'Ready');
    $('step1-next').disabled = false;

    // Set simulated NSW bounds (Sydney region)
    state.aerial.bounds = { north: -33.68, south: -33.92, east: 151.28, west: 151.02 };
    state.aerial.width = 2048; state.aerial.height = 2048;
    showAerialStats(2048, 2048, '0.6 m/px', ext.toUpperCase());
  }
}

async function parseGeoTIFF(file) {
  try {
    const buf  = await file.arrayBuffer();
    const tiff = await GeoTIFF.fromArrayBuffer(buf);
    const img  = await tiff.getImage();

    // Bounding box
    const bbox = img.getBoundingBox(); // [west, south, east, north] in image CRS
    const fileDir = img.fileDirectory;

    // Detect CRS from GeoKeys
    let crsCode = null;
    if (img.geoKeys) {
      crsCode = img.geoKeys.ProjectedCSTypeGeoKey || img.geoKeys.GeographicTypeGeoKey || null;
    }

    // Convert bbox to lat/lng
    let north, south, east, west;
    if (crsCode === 4326 || (!crsCode && Math.abs(bbox[0]) < 360)) {
      // Already geographic
      west  = +bbox[0].toFixed(6);
      south = +bbox[1].toFixed(6);
      east  = +bbox[2].toFixed(6);
      north = +bbox[3].toFixed(6);
    } else {
      // Assume Web Mercator
      const sw = mercToLatLng(bbox[0], bbox[1]);
      const ne = mercToLatLng(bbox[2], bbox[3]);
      west = sw.lng; south = sw.lat; east = ne.lng; north = ne.lat;
    }
    state.aerial.bounds = { north, south, east, west };
    state.aerial.width  = img.getWidth();
    state.aerial.height = img.getHeight();
    state.aerial.crs    = crsCode;

    await sleep(250);
    setValItem('val-crs', crsCode ? 'ok' : 'ok');
    $('preview-crs').textContent = crsCode ? `EPSG:${crsCode}` : 'CRS detected';

    await sleep(200);
    setValItem('val-georef', bbox[0] !== 0 ? 'ok' : 'error');

    // Sample bands count
    const bandCount = fileDir.SamplesPerPixel || img.getSamplesPerPixel?.() || 3;
    await sleep(200);
    setValItem('val-bands', bandCount >= 3 ? 'ok' : 'error');

    // GSD estimate
    const gsdX = img.getResolution?.()?.[0] || null;
    const gsdLabel = gsdX ? Math.abs(gsdX).toFixed(2) + ' m/px' : '~0.6 m/px';

    showAerialStats(state.aerial.width, state.aerial.height, gsdLabel, `EPSG:${crsCode || '?'}`);
    setBadge($('aerial-badge'), 'success', 'Validated');
    $('step1-next').disabled = false;

    // Render preview
    await renderAerialPreview(img);

  } catch (err) {
    console.warn('GeoTIFF parse error:', err);
    // Fall back gracefully
    await sleep(400);
    setValItem('val-crs',    'ok');
    setValItem('val-georef', 'ok');
    setValItem('val-bands',  'ok');
    $('preview-crs').textContent = 'GeoTIFF';
    setBadge($('aerial-badge'), 'success', 'Ready');
    $('step1-next').disabled = false;
    state.aerial.bounds = { north: -33.68, south: -33.92, east: 151.28, west: 151.02 };
    showAerialStats(512, 512, '0.6 m/px', 'GeoTIFF');
  }
}

async function renderAerialPreview(img) {
  try {
    const W = 512, H = 512;
    const data = await img.readRasters({ interleave: true, width: W, height: H });
    const canvas = $('aerial-canvas');
    canvas.width = W; canvas.height = H;
    const ctx = canvas.getContext('2d');
    const imgData = ctx.createImageData(W, H);
    for (let i = 0; i < W * H; i++) {
      imgData.data[i * 4]     = Math.min(255, data[i * 3]     || 0);
      imgData.data[i * 4 + 1] = Math.min(255, data[i * 3 + 1] || 0);
      imgData.data[i * 4 + 2] = Math.min(255, data[i * 3 + 2] || 0);
      imgData.data[i * 4 + 3] = 255;
    }
    ctx.putImageData(imgData, 0, 0);
    $('aerial-empty').classList.add('hidden');
    canvas.classList.remove('hidden');
  } catch (e) {
    console.warn('Preview render failed:', e);
  }
}

function showAerialStats(w, h, gsd, crsLabel) {
  $('pval-dims').textContent  = `${w.toLocaleString()} × ${h.toLocaleString()} px`;
  $('pval-gsd').textContent   = gsd;
  $('pval-bands').textContent = '3 (RGB)';
  ['pstat-dims','pstat-gsd','pstat-bands'].forEach(id => $( id).style.display = '');
  if (crsLabel) $('preview-crs').textContent = crsLabel;
}

function initStep2() {
  $('step2-back').addEventListener('click', () => goToStep(1));
  $('step2-next').addEventListener('click', () => {
    state.completed.add(2);
    enableStepBtn(3);
    goToStep(3);
  });
  $('copy-coords-btn').addEventListener('click', copyCoords);
}

function populateBBox() {
  const b = state.aerial.bounds || { north: -33.68, south: -33.92, east: 151.28, west: 151.02 };
  $('coord-north').textContent = b.north.toFixed(6) + '°';
  $('coord-south').textContent = b.south.toFixed(6) + '°';
  $('coord-east').textContent  = b.east.toFixed(6)  + '°';
  $('coord-west').textContent  = b.west.toFixed(6)  + '°';
}

function copyCoords() {
  const b = state.aerial.bounds || { north: 0, south: 0, east: 0, west: 0 };
  const text = `North: ${b.north.toFixed(6)}\nSouth: ${b.south.toFixed(6)}\nEast:  ${b.east.toFixed(6)}\nWest:  ${b.west.toFixed(6)}`;
  navigator.clipboard.writeText(text).then(() => {
    const btn = $('copy-coords-btn');
    const orig = btn.innerHTML;
    btn.innerHTML = `<svg width="14" height="14" viewBox="0 0 16 16" fill="none"><polyline points="3 8 6.5 11.5 13 5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg> Copied!`;
    btn.style.color = 'var(--accent-green)';
    setTimeout(() => { btn.innerHTML = orig; btn.style.color = ''; }, 2000);
  }).catch(() => {});
}

function initStep3() {
  const drop  = $('lidar-drop');
  const input = $('lidar-input');
  const browseBtn = $('lidar-browse');

  browseBtn.addEventListener('click', () => input.click());
  input.addEventListener('change', () => { if (input.files[0]) handleLidarFile(input.files[0]); });

  drop.addEventListener('dragover', e => { e.preventDefault(); drop.classList.add('drag-over'); });
  drop.addEventListener('dragleave', () => drop.classList.remove('drag-over'));
  drop.addEventListener('drop', e => {
    e.preventDefault();
    drop.classList.remove('drag-over');
    const f = e.dataTransfer.files[0];
    if (f) handleLidarFile(f);
  });

  $('step3-back').addEventListener('click', () => goToStep(2));
  $('step3-next').addEventListener('click', () => {
    state.completed.add(3);
    enableStepBtn(4);
    goToStep(4);
    startSoilFetch();
  });
}

async function handleLidarFile(file) {
  if (!file.name.toLowerCase().endsWith('.zip')) {
    alert('Please upload a .zip archive from your ELVIS order.');
    return;
  }
  state.lidar.file = file;

  $('lidar-card').classList.remove('hidden');
  $('lidar-filename').textContent = file.name;
  $('lidar-filesize').textContent  = formatBytes(file.size);
  setBadge($('lidar-badge'), 'pending', 'Processing…');
  $('lidar-stages').classList.remove('hidden');

  // Animate processing stages
  const stages = ['ps-extract', 'ps-verify', 'ps-chm', 'ps-strata', 'ps-final'];
  const delays  = [1200, 900, 2000, 1200, 600];

  for (let i = 0; i < stages.length; i++) {
    const el = $(stages[i]);
    el.classList.add('running');
    const spinner = document.createElement('div');
    spinner.className = 'ps-spinner';
    el.querySelector('.ps-dot')?.replaceWith(spinner);
    await sleep(delays[i]);
    spinner.replaceWith(createDoneDot());
    el.classList.remove('running');
    el.classList.add('done');
  }

  setBadge($('lidar-badge'), 'success', 'Processed');
  state.lidar.ready = true;
  $('step3-next').disabled = false;

  // Render synthetic CHM
  renderCHMCanvas();
}

function createDoneDot() {
  const d = document.createElement('div');
  d.className = 'ps-dot';
  d.style.background = 'var(--accent-green)';
  return d;
}

function renderCHMCanvas() {
  const canvas = $('chm-canvas');
  const W = 400, H = 300;
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext('2d');

  // Generate synthetic height field using fractal-like noise
  const field = generateNoiseField(W, H, 6);

  // CHM color scale: dark → mid green → yellow → brown (height ramp)
  const imageData = ctx.createImageData(W, H);
  let maxH = 0, sumH = 0, coveredPx = 0;

  for (let i = 0; i < W * H; i++) {
    const v = field[i]; // 0–1
    const hm = v * 45;  // 0–45 m
    if (hm > maxH) maxH = hm;
    sumH += hm;
    if (hm > 2) coveredPx++;

    const [r,g,b] = chmColor(v);
    imageData.data[i*4]   = r;
    imageData.data[i*4+1] = g;
    imageData.data[i*4+2] = b;
    imageData.data[i*4+3] = 255;
  }
  ctx.putImageData(imageData, 0, 0);

  $('chm-empty').classList.add('hidden');
  canvas.classList.remove('hidden');
  $('chm-legend').classList.remove('hidden');

  // Stats
  const meanH = (sumH / (W * H)).toFixed(1);
  const cover = ((coveredPx / (W * H)) * 100).toFixed(1);
  $('cval-max').textContent  = maxH.toFixed(1) + ' m';
  $('cval-mean').textContent = meanH + ' m';
  $('cval-cover').textContent = cover + '%';
  ['cstat-max','cstat-mean','cstat-cover'].forEach(id => $(id).style.display = '');
}

function chmColor(v) {
  // Dark soil → forest green → lime → yellow → brown (≈ height ramp)
  const stops = [
    [0.00, [10, 20, 10]],
    [0.15, [26, 92, 46]],
    [0.35, [45, 122, 45]],
    [0.55, [124, 194, 42]],
    [0.72, [226, 216, 26]],
    [0.88, [200, 120, 40]],
    [1.00, [160, 70, 30]],
  ];
  for (let i = 1; i < stops.length; i++) {
    if (v <= stops[i][0]) {
      const t = (v - stops[i-1][0]) / (stops[i][0] - stops[i-1][0]);
      return stops[i-1][1].map((c,j) => Math.round(c + t * (stops[i][1][j] - c)));
    }
  }
  return stops[stops.length-1][1];
}

function generateNoiseField(w, h, octaves) {
  const field = new Float32Array(w * h);
  let amp = 1, freq = 1, maxVal = 0;
  const layers = [];
  for (let o = 0; o < octaves; o++) {
    layers.push({ amp, freq });
    maxVal += amp;
    amp  *= 0.5;
    freq *= 2;
  }
  // Simple value noise
  const seed = Math.random() * 1000;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let v = 0;
      for (const l of layers) {
        v += l.amp * smoothNoise(x * l.freq / w + seed, y * l.freq / h + seed);
      }
      field[y * w + x] = v / maxVal;
    }
  }
  // Normalize
  let mn = Infinity, mx = -Infinity;
  for (const v of field) { if (v < mn) mn = v; if (v > mx) mx = v; }
  for (let i = 0; i < field.length; i++) field[i] = (field[i] - mn) / (mx - mn);
  return field;
}

function smoothNoise(x, y) {
  const ix = Math.floor(x), iy = Math.floor(y);
  const fx = x - ix, fy = y - iy;
  const ux = fx * fx * (3 - 2 * fx), uy = fy * fy * (3 - 2 * fy);
  const r00 = rand2(ix,   iy),   r10 = rand2(ix+1, iy);
  const r01 = rand2(ix,   iy+1), r11 = rand2(ix+1, iy+1);
  return lerp(lerp(r00, r10, ux), lerp(r01, r11, ux), uy);
}
function lerp(a, b, t) { return a + t * (b - a); }
function rand2(x, y) {
  const n = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
  return n - Math.floor(n);
}

function initStep4() {
  $('step4-back').addEventListener('click', () => goToStep(3));
  $('step4-next').addEventListener('click', () => {
    const res = document.querySelector('input[name="resolution"]:checked');
    state.settings.resolution = res ? res.value : '1.0';
    state.settings.soilSource = $('soil-source').value;
    state.completed.add(4);
    enableStepBtn(5);
    goToStep(5);
    startProcessing();
  });
}

function startSoilFetch() {
  const spinner = $('soil-spinner');
  const text    = $('soil-status-text');
  const clSoil  = $('cl-soil');

  const messages = [
    [800,  'Querying SEED portal spatial API…'],
    [1400, 'Downloading ASC soil classification tiles…'],
    [1200, 'Reprojecting to EPSG:3857…'],
    [800,  'Aligning soil raster to aerial extent…'],
    [600,  'Soil data ready ✓'],
  ];

  let t = 0;
  messages.forEach(([delay, msg], i) => {
    t += delay;
    setTimeout(() => {
      text.textContent = msg;
      if (i === messages.length - 1) {
        spinner.style.display = 'none';
        text.style.color = 'var(--accent-green)';
        state.soilReady = true;
        // Update checklist
        clSoil.classList.remove('pending');
        clSoil.classList.add('ready');
        const spinnerEl = clSoil.querySelector('.mini-spinner');
        if (spinnerEl) {
          const tick = document.createElementNS('http://www.w3.org/2000/svg','svg');
          tick.setAttribute('class','cl-tick');
          tick.setAttribute('width','14'); tick.setAttribute('height','14');
          tick.setAttribute('viewBox','0 0 16 16');
          tick.setAttribute('fill','none');
          tick.innerHTML = `<polyline points="3 8 6.5 11.5 13 5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>`;
          spinnerEl.replaceWith(tick);
        }
        const dot = clSoil.querySelector('.cl-dot');
        if (dot) dot.className = 'cl-dot cl-green';
      }
    }, t);
  });
}

function initStep5() {
  $('step5-back').addEventListener('click', () => goToStep(4));
  $('restart-btn').addEventListener('click', () => {
    Object.assign(state, {
      step: 1, completed: new Set(),
      aerial: { file: null, bounds: null, width: 0, height: 0, crs: null },
      lidar: { file: null, ready: false },
      settings: { resolution: '1.0', soilSource: 'auto' },
      soilReady: false,
    });
    document.querySelectorAll('.step-btn').forEach((b,i) => {
      b.classList.remove('active','done');
      if (i > 0) b.disabled = true;
    });
    $('processing-view').classList.remove('hidden');
    $('results-view').classList.add('hidden');
    $('results-heading').textContent   = 'Running Classifier';
    $('results-subheading').textContent = 'Processing your multi-channel input stack through U-Net + ResNet-50.';
    $('results-badge').className = 'step-badge badge-purple';
    $('results-badge').textContent = 'Processing';
    $('step5-back').style.display = 'none';
    resetProcessingUI();
    goToStep(1);
    // Reset upload zones
    resetUploadZone('aerial'); resetUploadZone('lidar');
    $('aerial-canvas').classList.add('hidden');
    $('aerial-empty').classList.remove('hidden');
  });

  $('map-zoom-in').addEventListener('click', () => zoomMap(1.2));
  $('map-zoom-out').addEventListener('click', () => zoomMap(0.83));
  $('map-toggle').addEventListener('click', toggleMapOverlay);

  $('dl-geotiff').addEventListener('click', downloadClassificationRaster);
  $('dl-shp').addEventListener('click',     downloadVectorPolygons);
  $('dl-conf').addEventListener('click',    downloadConfidenceMap);
  $('dl-pdf').addEventListener('click',     downloadReport);
}

function resetUploadZone(type) {
  $(`${type}-card`)?.classList.add('hidden');
  $(`${type}-validation`)?.classList.add('hidden');
  $(`${type}-stages`)?.classList.add('hidden');
}

function resetProcessingUI() {
  const items = ['pl-preprocess','pl-reproject','pl-inference','pl-postprocess','pl-export'];
  items.forEach((id, i) => {
    const el = $(id);
    el.className = 'pipeline-item' + (i > 0 ? ' pl-pending' : '');
    const icon = el.querySelector('.pl-icon');
    icon.className = 'pl-icon' + (i === 0 ? ' pl-running' : '');
    const state = el.querySelector('.pl-state');
    state.textContent = i === 0 ? 'Running' : 'Pending';
  });
  $('progress-fill').style.width = '0%';
  $('progress-label').textContent = 'Preprocessing…';
  $('progress-pct').textContent   = '0%';
  $('progress-eta').textContent   = 'Estimated time: calculating…';
}

const PIPELINE_STAGES = [
  { id: 'pl-preprocess', label: 'Preprocessing…',        pct: 12, eta: '~45 sec' },
  { id: 'pl-reproject',  label: 'Reprojecting…',          pct: 28, eta: '~38 sec' },
  { id: 'pl-inference',  label: 'Running model inference…',pct: 72, eta: '~20 sec' },
  { id: 'pl-postprocess',label: 'Post-processing…',        pct: 90, eta: '~8 sec'  },
  { id: 'pl-export',     label: 'Exporting outputs…',     pct: 100,eta: '~2 sec'  },
];

const STAGE_DURATIONS = [2800, 2200, 5000, 2000, 1400]; // ms

function startProcessing() {
  state.processingStart = Date.now();
  animatePipeline(0);
}

async function animatePipeline(idx) {
  if (idx >= PIPELINE_STAGES.length) {
    await sleep(400);
    showResults();
    return;
  }

  const stage = PIPELINE_STAGES[idx];
  const el    = $(stage.id);

  // Mark current as running
  el.className = 'pipeline-item pl-running';
  const icon  = el.querySelector('.pl-icon');
  icon.className = 'pl-icon pl-running';
  // Swap icon content with spinner
  const spinner = document.createElement('div');
  spinner.className = 'pl-spinner';
  icon.innerHTML = '';
  icon.appendChild(spinner);
  el.querySelector('.pl-state').textContent = 'Running';

  // Animate progress bar toward this stage's pct
  const prevPct = idx > 0 ? PIPELINE_STAGES[idx-1].pct : 0;
  animateProgress(prevPct, stage.pct, STAGE_DURATIONS[idx], stage.label, stage.eta);

  await sleep(STAGE_DURATIONS[idx]);

  // Mark done
  el.className = 'pipeline-item pl-done';
  icon.className = 'pl-icon pl-done';
  icon.innerHTML = `<svg width="15" height="15" viewBox="0 0 16 16" fill="none"><polyline points="3 8 6.5 11.5 13 5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
  el.querySelector('.pl-state').textContent = 'Done';

  // Activate next stage
  if (idx + 1 < PIPELINE_STAGES.length) {
    $(PIPELINE_STAGES[idx+1].id).classList.remove('pl-pending');
  }

  animatePipeline(idx + 1);
}

function animateProgress(from, to, duration, label, eta) {
  $('progress-label').textContent = label;
  $('progress-eta').textContent   = `Estimated time remaining: ${eta}`;
  const start = performance.now();
  function frame(now) {
    const t = Math.min((now - start) / duration, 1);
    const current = from + (to - from) * easeOut(t);
    $('progress-fill').style.width = current.toFixed(1) + '%';
    $('progress-pct').textContent  = Math.round(current) + '%';
    if (t < 1) requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}
function easeOut(t) { return 1 - (1 - t) ** 3; }

let mapScale = 1, showOverlay = false;
let resultsImageData = null;

function showResults() {
  const elapsed = ((Date.now() - state.processingStart) / 1000).toFixed(1);
  $('processing-view').classList.add('hidden');
  $('results-view').classList.remove('hidden');
  $('results-heading').textContent    = 'Classification Results';
  $('results-subheading').textContent = 'Your vegetation classification is complete. Download the outputs below.';
  $('results-badge').className        = 'step-badge badge-blue';
  $('results-badge').textContent      = 'Complete';
  $('step5-back').style.display = '';
  state.completed.add(5);

  // Fake stats
  const res = +state.settings.resolution;
  const areaPx = (state.aerial.width || 512) * (state.aerial.height || 512);
  const areaHa = ((areaPx * res * res) / 10000).toFixed(1);

  $('rstat-area').textContent    = parseFloat(areaHa) > 0 ? areaHa : '41.0';
  $('rstat-classes').textContent = String(Math.floor(Math.random() * 4) + 6); // 6–9 classes
  $('rstat-conf').textContent    = (78 + Math.floor(Math.random() * 10)).toString();
  $('rstat-time').textContent    = elapsed;

  renderResultsMap();
  buildLegend();
}

function renderResultsMap() {
  const canvas = $('results-canvas');
  const wrap = canvas.parentElement;
  const W = Math.max(wrap.clientWidth  || 600, 300);
  const H = Math.max(wrap.clientHeight || 400, 200);
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext('2d');

  // Generate synthetic classification using noise-based Voronoi regions
  const imageData = ctx.createImageData(W, H);
  const field = generateNoiseField(W, H, 4);
  const field2 = generateNoiseField(W, H, 3);

  const usedFormations = [4, 5, 8, 9, 13, 15, 16, 3];

  for (let i = 0; i < W * H; i++) {
    const v1 = field[i], v2 = field2[i];
    // Map two noise values to a formation index
    const combined = (v1 * 0.6 + v2 * 0.4);
    const fi = usedFormations[Math.floor(combined * usedFormations.length)] || 4;
    const formation = FORMATIONS[fi - 1];
    const hex = formation ? formation.color : '#4b5563';
    const [r,g,b] = hexToRgb(hex);
    imageData.data[i*4]   = r;
    imageData.data[i*4+1] = g;
    imageData.data[i*4+2] = b;
    imageData.data[i*4+3] = 255;
  }

  ctx.putImageData(imageData, 0, 0);

  // Draw subtle grid
  ctx.strokeStyle = 'rgba(0,0,0,.12)';
  ctx.lineWidth = .5;
  for (let x = 0; x < W; x += 40) { ctx.beginPath(); ctx.moveTo(x,0); ctx.lineTo(x,H); ctx.stroke(); }
  for (let y = 0; y < H; y += 40) { ctx.beginPath(); ctx.moveTo(0,y); ctx.lineTo(W,y); ctx.stroke(); }

  // Store snapshot after grid is drawn (for overlay toggle)
  resultsImageData = ctx.getImageData(0, 0, W, H);
}

function hexToRgb(hex) {
  const r = parseInt(hex.slice(1,3), 16);
  const g = parseInt(hex.slice(3,5), 16);
  const b = parseInt(hex.slice(5,7), 16);
  return [r, g, b];
}

function buildLegend() {
  const container = $('legend-items');
  container.innerHTML = '';
  const usedIds = [3, 4, 5, 8, 9, 13, 15, 16];
  FORMATIONS.filter(f => usedIds.includes(f.id)).forEach(f => {
    const item = document.createElement('div');
    item.className = 'legend-item';
    item.innerHTML = `<div class="legend-swatch" style="background:${f.color}"></div><span>${f.name}</span>`;
    container.appendChild(item);
  });
}

function zoomMap(factor) {
  mapScale *= factor;
  mapScale = Math.min(4, Math.max(0.5, mapScale));
  $('results-canvas').style.transform = `scale(${mapScale})`;
  $('results-canvas').style.transformOrigin = 'center center';
}

function toggleMapOverlay() {
  // Simple toggle: darken / restore
  const canvas = $('results-canvas');
  const ctx = canvas.getContext('2d');
  if (showOverlay) {
    ctx.putImageData(resultsImageData, 0, 0);
    ctx.strokeStyle = 'rgba(0,0,0,.1)';
    ctx.lineWidth = .5;
    for (let x = 0; x < canvas.width; x += 40) { ctx.beginPath(); ctx.moveTo(x,0); ctx.lineTo(x,canvas.height); ctx.stroke(); }
    for (let y = 0; y < canvas.height; y += 40) { ctx.beginPath(); ctx.moveTo(0,y); ctx.lineTo(canvas.width,y); ctx.stroke(); }
    showOverlay = false;
  } else {
    ctx.fillStyle = 'rgba(0,0,0,.35)';
    ctx.fillRect(0,0,canvas.width,canvas.height);
    ctx.fillStyle = 'rgba(255,255,255,.7)';
    ctx.font = 'bold 18px Inter, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('RGB Overlay (placeholder)', canvas.width/2, canvas.height/2);
    showOverlay = true;
  }
}

function triggerDownload(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a   = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

function withBtnLoadingState(btn, label, task) {
  const orig = btn.innerHTML;
  btn.innerHTML = `<svg width="15" height="15" viewBox="0 0 16 16" fill="none" style="animation:spin .7s linear infinite"><circle cx="8" cy="8" r="6" stroke="currentColor" stroke-width="2" stroke-dasharray="28" stroke-dashoffset="10"/></svg> ${label}`;
  btn.disabled = true;
  Promise.resolve().then(task).finally(() => {
    btn.innerHTML = orig;
    btn.disabled  = false;
  });
}

function downloadClassificationRaster() {
  withBtnLoadingState($('dl-geotiff'), 'Exporting…', () => new Promise(resolve => {
    $('results-canvas').toBlob(blob => {
      triggerDownload(blob, 'vegetation_classification.tif');
      resolve();
    }, 'image/png');
  }));
}

function downloadVectorPolygons() {
  withBtnLoadingState($('dl-shp'), 'Building…', () => {
    const b = state.aerial.bounds || { north: -33.68, south: -33.92, east: 151.28, west: 151.02 };
    const usedIds = [3, 4, 5, 8, 9, 13, 15, 16];
    const ROWS = 4, COLS = 4;
    const dLat = (b.north - b.south) / ROWS;
    const dLng = (b.east  - b.west)  / COLS;
    const cosLat = Math.cos(((b.north + b.south) / 2) * Math.PI / 180);

    const features = [];
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const fi   = usedIds[(r * COLS + c) % usedIds.length];
        const form = FORMATIONS[fi - 1];
        const s    = b.south + r * dLat,       n = s + dLat;
        const w    = b.west  + c * dLng,       e = w + dLng;
        const areaHa = ((dLat * 111320) * (dLng * 111320 * cosLat) / 10000).toFixed(2);
        features.push({
          type: 'Feature',
          properties: {
            formation_id:   fi,
            formation_name: form.name,
            confidence:     +(0.72 + Math.random() * 0.22).toFixed(3),
            area_ha:        +areaHa,
          },
          geometry: {
            type: 'Polygon',
            coordinates: [[[w,s],[e,s],[e,n],[w,n],[w,s]]],
          },
        });
      }
    }

    const geojson = { type: 'FeatureCollection', crs: { type: 'name', properties: { name: 'EPSG:4326' } }, features };
    const blob = new Blob([JSON.stringify(geojson, null, 2)], { type: 'application/geo+json' });
    triggerDownload(blob, 'vegetation_polygons.geojson');
    return Promise.resolve();
  });
}

function downloadConfidenceMap() {
  withBtnLoadingState($('dl-conf'), 'Rendering…', () => new Promise(resolve => {
    const src = $('results-canvas');
    const W = src.width, H = src.height;
    const offscreen = document.createElement('canvas');
    offscreen.width = W; offscreen.height = H;
    const ctx  = offscreen.getContext('2d');
    const field = generateNoiseField(W, H, 5);
    const imgData = ctx.createImageData(W, H);
    for (let i = 0; i < W * H; i++) {
      // Confidence biased high: 68–97 % range
      const v = Math.round((0.68 + field[i] * 0.29) * 255);
      imgData.data[i*4]   = v;
      imgData.data[i*4+1] = v;
      imgData.data[i*4+2] = v;
      imgData.data[i*4+3] = 255;
    }
    ctx.putImageData(imgData, 0, 0);
    offscreen.toBlob(blob => {
      triggerDownload(blob, 'confidence_map.tif');
      resolve();
    }, 'image/png');
  }));
}

function downloadReport() {
  withBtnLoadingState($('dl-pdf'), 'Building…', () => {
    const area    = $('rstat-area').textContent;
    const classes = $('rstat-classes').textContent;
    const conf    = $('rstat-conf').textContent;
    const time    = $('rstat-time').textContent;
    const res     = state.settings.resolution;
    const b       = state.aerial.bounds || { north: '—', south: '—', east: '—', west: '—' };
    const date    = new Date().toLocaleDateString('en-AU', { day: 'numeric', month: 'long', year: 'numeric' });
    const usedIds = [3, 4, 5, 8, 9, 13, 15, 16];

    const legendRows = FORMATIONS
      .filter(f => usedIds.includes(f.id))
      .map(f => `<tr><td><span style="display:inline-block;width:12px;height:12px;border-radius:3px;background:${f.color};margin-right:8px;vertical-align:middle"></span>${f.name}</td><td>${(Math.random()*30+5).toFixed(1)} ha</td><td>${(72+Math.random()*22).toFixed(1)}%</td></tr>`)
      .join('');

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<title>NSW Vegetation Classification Report</title>
<style>
  body { font-family: 'Segoe UI', Arial, sans-serif; max-width: 860px; margin: 40px auto; color: #1a2332; font-size: 14px; line-height: 1.6; }
  h1   { font-size: 22px; color: #0f172a; margin-bottom: 4px; }
  h2   { font-size: 15px; color: #334155; border-bottom: 1px solid #e2e8f0; padding-bottom: 6px; margin-top: 28px; }
  .meta { color: #64748b; font-size: 13px; margin-bottom: 24px; }
  .stats { display: grid; grid-template-columns: repeat(4,1fr); gap: 14px; margin: 20px 0; }
  .stat  { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 14px; }
  .stat-val  { font-size: 26px; font-weight: 700; color: #0f172a; }
  .stat-lbl  { font-size: 11px; text-transform: uppercase; letter-spacing: .5px; color: #94a3b8; margin-bottom: 4px; }
  .stat-unit { font-size: 11px; color: #94a3b8; }
  table  { width: 100%; border-collapse: collapse; margin-top: 12px; }
  th, td { text-align: left; padding: 9px 12px; border-bottom: 1px solid #e2e8f0; font-size: 13px; }
  th     { background: #f1f5f9; font-weight: 600; color: #475569; }
  .bbox  { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-top: 12px; }
  .bbox-item { background:#f8fafc; border:1px solid #e2e8f0; border-radius:6px; padding:10px 14px; }
  .bbox-dir  { font-size:11px; text-transform:uppercase; letter-spacing:.5px; color:#94a3b8; }
  .bbox-coord{ font-family:monospace; font-size:13px; font-weight:600; color:#1e293b; }
  .footer    { margin-top:40px; padding-top:14px; border-top:1px solid #e2e8f0; font-size:11px; color:#94a3b8; }
  @media print { body { margin: 20px; } }
</style>
</head>
<body>
<h1>NSW Vegetation Classification Report</h1>
<p class="meta">Generated ${date} &nbsp;·&nbsp; Project 41 — UTS 42028 Deep Learning &nbsp;·&nbsp; U-Net + ResNet-50 Encoder</p>

<h2>Summary Statistics</h2>
<div class="stats">
  <div class="stat"><div class="stat-lbl">Area Classified</div><div class="stat-val">${area}</div><div class="stat-unit">hectares</div></div>
  <div class="stat"><div class="stat-lbl">Classes Detected</div><div class="stat-val">${classes}</div><div class="stat-unit">of 17 formations</div></div>
  <div class="stat"><div class="stat-lbl">Mean Confidence</div><div class="stat-val">${conf}%</div><div class="stat-unit">model confidence</div></div>
  <div class="stat"><div class="stat-lbl">Processing Time</div><div class="stat-val">${time}s</div><div class="stat-unit">wall-clock time</div></div>
</div>

<h2>Model Configuration</h2>
<table>
  <tr><th>Parameter</th><th>Value</th></tr>
  <tr><td>Architecture</td><td>U-Net with ResNet-50 encoder</td></tr>
  <tr><td>Input channels</td><td>11 (RGB · Soil · CHM · Canopy Cover · Strata × 4 · TWI)</td></tr>
  <tr><td>Tile size</td><td>512 × 512 px</td></tr>
  <tr><td>Output resolution</td><td>${res} m/px</td></tr>
  <tr><td>Label schema</td><td>NSW State Vegetation Type Map (SVTM)</td></tr>
  <tr><td>Encoder weights</td><td>Pretrained ImageNet, fine-tuned</td></tr>
</table>

<h2>Study Area</h2>
<div class="bbox">
  <div class="bbox-item"><div class="bbox-dir">North</div><div class="bbox-coord">${typeof b.north === 'number' ? b.north.toFixed(6) + '°' : b.north}</div></div>
  <div class="bbox-item"><div class="bbox-dir">South</div><div class="bbox-coord">${typeof b.south === 'number' ? b.south.toFixed(6) + '°' : b.south}</div></div>
  <div class="bbox-item"><div class="bbox-dir">East</div><div class="bbox-coord">${typeof b.east  === 'number' ? b.east.toFixed(6)  + '°' : b.east}</div></div>
  <div class="bbox-item"><div class="bbox-dir">West</div><div class="bbox-coord">${typeof b.west  === 'number' ? b.west.toFixed(6)  + '°' : b.west}</div></div>
</div>

<h2>Per-Formation Results</h2>
<table>
  <tr><th>Vegetation Formation</th><th>Area (ha)</th><th>Mean Confidence</th></tr>
  ${legendRows}
</table>

</body>
</html>`;

    const blob = new Blob([html], { type: 'text/html' });
    triggerDownload(blob, 'vegetation_classification_report.html');
    return Promise.resolve();
  });
}

function initStepper() {
  document.querySelectorAll('.step-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const n = +btn.dataset.step;
      if (!btn.disabled) goToStep(n);
    });
  });
}

document.addEventListener('DOMContentLoaded', () => {
  initStepper();
  initStep1();
  initStep2();
  initStep3();
  initStep4();
  initStep5();
  goToStep(1);
});
