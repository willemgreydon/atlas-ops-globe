# 12 — Weather · Sources

`openmeteo` is registered (`next`, the designated backbone); the rest are planned
dossiers. Conservative `LicenseStance` throughout.

### Open-Meteo — `openmeteo` — REGISTERED (status: next) — BACKBONE
- **baseUrl:** `https://api.open-meteo.com/v1/` · **type:** api · **auth:** none
- **polling:** true · **rate:** `minIntervalSec: 1`, `cacheTtlSec: 900` (15 min),
  `concurrency: 4`, `maxRetries: 3` · **format:** JSON
- **licensing:** CC BY 4.0 → `commercialUse: allowed`,
  `redistribution: review-required`, attribution required
  ("Open-Meteo (CC BY 4.0)")
- **coverage:** global forecast + current + historical (ECMWF/GFS/ICON blended);
  temperature, precipitation, wind, pressure, clouds, visibility, snow, humidity
- **history:** reanalysis back to 1940 (ERA5) · **status:** `next`
  (`enabled:false`) · **priority:** Medium — weather backbone
- **sample:** `https://api.open-meteo.com/v1/forecast?latitude=48.2&longitude=16.4&hourly=temperature_2m,precipitation,wind_speed_10m`

### ECMWF — PLANNED
- **baseUrl:** `https://api.ecmwf.int/` / Open Data `https://data.ecmwf.int/`
- **type:** api/bulk · **auth:** api-key (some open, some licensed)
- **format:** GRIB (**raster**) · **licensing:** ECMWF licence (open-data subset
  CC BY 4.0; full IFS licensed) → `review-required` · **coverage:** global IFS
  forecasts, ensembles · **priority:** Medium (authoritative model)

### NOAA — PLANNED
- **baseUrl:** `https://api.weather.gov/` / NOMADS `https://nomads.ncep.noaa.gov/`
- **type:** api/bulk · **auth:** none · **format:** JSON / GRIB (**raster**)
- **licensing:** US Gov open data → `allowed` · **coverage:** GFS global model,
  US point forecasts, alerts/storms · **priority:** Medium

### DWD — Deutscher Wetterdienst — PLANNED
- **baseUrl:** `https://opendata.dwd.de/`
- **type:** bulk · **auth:** none · **format:** GRIB2/CSV (**raster** for models)
- **licensing:** GeoNutzV → `allowed`, attribution required · **coverage:** ICON
  global/EU model, German station network · **priority:** Low (EU-centric)

### MET Norway — PLANNED
- **baseUrl:** `https://api.met.no/weatherapi/`
- **type:** api · **auth:** none (User-Agent required) · **rate:** fair-use →
  plan `minIntervalSec: 2` · **format:** JSON · **licensing:** NLOD / CC BY 4.0 →
  `allowed`, attribution required · **coverage:** Nordic + global Locationforecast
- **priority:** Low
- **sample:** `https://api.met.no/weatherapi/locationforecast/2.0/compact?lat=48.2&lon=16.4`

> **Discipline:** point APIs (Open-Meteo, MET Norway, NOAA points) feed the
> vector `weather_observations` layer; GRIB model output (ECMWF/NOAA/DWD) is
> **raster** — store as external references + metadata, not pixel blobs. Keep
> forecast **issue** time separate from **target** time in every record.
