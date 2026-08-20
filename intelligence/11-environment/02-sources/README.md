# 11 — Environment · Sources

`eonet` is live (shared via disasters); `openmeteo` is registered (`next`). The
rest are planned dossiers. Conservative `LicenseStance` throughout.

### NASA EONET — `eonet` — IMPLEMENTED (shared with disasters)
- **baseUrl:** `https://eonet.gsfc.nasa.gov/api/v3/` · **type:** api · **auth:** none
- **rate:** `minIntervalSec: 5`, `cacheTtlSec: 300` · **format:** JSON
- **licensing:** NASA open data → `allowed`/`allowed`, attribution "NASA EONET"
- **coverage:** natural-event tracking (wildfires, storms, volcanoes) — lands as
  `DisasterEvent` under disasters, not as `EnvironmentalObservation`
- **priority:** — (already live) · **sample:** `https://eonet.gsfc.nasa.gov/api/v3/events`

### Open-Meteo Air Quality — `openmeteo` — REGISTERED (status: next)
- **baseUrl:** `https://api.open-meteo.com/v1/` (Air Quality: `air-quality-api…`)
- **type:** api · **auth:** none · **rate:** `minIntervalSec: 1`,
  `cacheTtlSec: 900`, `concurrency: 4` · **format:** JSON
- **licensing:** CC BY 4.0 → `commercialUse: allowed`,
  `redistribution: review-required`, attribution "Open-Meteo (CC BY 4.0)"
- **coverage:** PM2.5, PM10, NO2, SO2, CO, ozone, aerosol/dust indices (CAMS-fed)
- **history:** reanalysis back-catalog · **status:** `next` (`enabled:false`)
- **priority:** Medium · **sample:**
  `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=48.2&longitude=16.4&hourly=pm2_5,pm10,nitrogen_dioxide`

### Copernicus CAMS — PLANNED
- **baseUrl:** `https://ads.atmosphere.copernicus.eu/` (ADS/CDS API)
- **type:** api/bulk · **auth:** api-key (ADS token) · **format:** NetCDF/GRIB
  (**raster**) · **licensing:** Copernicus licence → `review-required`,
  attribution required · **coverage:** global atmospheric composition, aerosol,
  dust, smoke forecasts/reanalysis · **priority:** High (authoritative air quality)

### NASA (products) — PLANNED
- **baseUrl:** `https://earthdata.nasa.gov/` · **auth:** Earthdata login
- **format:** HDF/NetCDF/GeoTIFF (**raster**) · **licensing:** NASA open data →
  `allowed` · **coverage:** MODIS/VIIRS vegetation (NDVI), SST, soil moisture,
  ice · **priority:** Medium

### NOAA — PLANNED
- **baseUrl:** `https://www.ncei.noaa.gov/` / `https://api.weather.gov/`
- **auth:** none/token · **format:** JSON/NetCDF (**raster** for grids)
- **licensing:** US Gov open data → `allowed` · **coverage:** SST, drought
  (US Drought Monitor), ice · **priority:** Medium

### Sentinel (Copernicus) — PLANNED
- **baseUrl:** `https://dataspace.copernicus.eu/` · **auth:** oauth
- **format:** GeoTIFF/JP2 (**raster**) · **licensing:** Copernicus →
  `review-required` · **coverage:** Sentinel-2/3/5P imagery, NO2, vegetation
- **priority:** Low (heavy raster; store as external refs)

### EPA — PLANNED
- **baseUrl:** `https://aqs.epa.gov/data/api/` · **auth:** api-key
- **format:** JSON · **licensing:** US Gov open data → `allowed`
- **coverage:** US station-level air/water quality · **priority:** Low (US-only)

> **Raster discipline:** CAMS/NASA/NOAA/Sentinel are raster-heavy — register them
> to store **external references + metadata**, not pixel payloads.
