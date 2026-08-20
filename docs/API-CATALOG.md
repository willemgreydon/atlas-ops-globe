# API catalog for a high-detail operational globe

The practical strategy is **multi-provider**. No single API gives you all aircraft, vessels, people, news, sanctions, hazards, weather, economics and geopolitical events with global detail and redistribution rights.

## Aviation / live planes

| Provider | What it gives you | Auth / access | Best use |
|---|---|---|---|
| OpenSky Network | live state vectors, flights, tracks | public + authenticated tiers/rate limits | best zero-cost starting connector |
| FlightAware AeroAPI / Firehose | commercial flight status, positions, schedules, airport ops | commercial | production-grade aviation coverage & metadata |
| ADS-B Exchange | dense ADS-B positions / history | commercial/API plans | richer aircraft tracking; assess licensing carefully |
| aviationstack / Cirium | schedules/status/airports/airlines | key/commercial | enrich aircraft tracks with flight context |

**Required data model:** ICAO24/registration/callsign, lat/lon/altitude, ground speed, heading, vertical rate, squawk, origin/destination, timestamps, aircraft metadata.

## Maritime / live ships

| Provider | What it gives you | Auth / access | Best use |
|---|---|---|---|
| MarineTraffic AIS API | current/historical AIS, vessel metadata, port calls | API key/commercial | premium production integration |
| AISstream | websocket AIS stream | API key | fast real-time prototype |
| Spire Maritime | global AIS + vessel intelligence | commercial | enterprise coverage |
| VesselFinder API | AIS/vessel/port information | commercial | alternative maritime feed |

**Required data model:** MMSI/IMO, vessel type, lat/lon, SOG, COG, heading, nav status, draught, destination/ETA, last AIS timestamp, track history. For “dark vessels”, derive *loss of expected AIS* cautiously and label it as an analytic indicator, not proof of wrongdoing.

## Global news, headlines and event discovery

| Provider | What it gives you | Auth | Best use |
|---|---|---|---|
| GDELT DOC 2.0 | global multilingual news search, near-real-time coverage | generally no key | primary broad discovery layer |
| GDELT Events / GKG | event coding, people/org/themes/locations | bulk/feeds | event/entity graph and trend analytics |
| Event Registry | global news, topics, concepts, event clusters, entities | key/commercial tiers | high-quality article clustering/entity features |
| NewsAPI | publisher/article search | key | simple news source complement |
| Guardian Open Platform / NYT APIs | first-party publisher data | key | reputable source enrichment |
| Common Crawl | web-scale archive | open | offline enrichment, not real-time UX |

To cover “people in public news”, map named entities to canonical IDs (prefer Wikidata QIDs), retain every article/source edge, and display mention counts/trends rather than fabricating biographies from text snippets.

## Public people / organizations / knowledge graph

| Provider | What it gives you | Access | Best use |
|---|---|---|---|
| Wikidata SPARQL + APIs | canonical public entities, aliases, roles, geographic IDs | open | entity resolution backbone |
| Wikimedia REST/Action APIs | article summaries/media | open with policies | human-readable context/cards |
| Diffbot Knowledge Graph | entity extraction + global entity graph | commercial | high-scale entity enrichment |
| Event Registry concepts | person/org/location concepts tied to news | commercial/free tiers | news-native entity graph |

## Conflict / protests / political violence

| Provider | What it gives you | Access | Best use |
|---|---|---|---|
| ACLED | geocoded political violence, demonstrations, strategic developments | account + OAuth/API | conflict map and statistics |
| UCDP | armed conflict/event datasets | open/research terms | conflict history / validation |
| GDELT Events | machine-coded global events | open feeds | high-frequency event discovery |

## Humanitarian crises / disasters

| Provider | What it gives you | Access | Best use |
|---|---|---|---|
| ReliefWeb API v2 | curated humanitarian reports, disasters, countries, sources | approved `appname`, quota | crisis narrative + source documents |
| GDACS | global disaster alerts | open feeds/services | severity alert layer |
| NASA EONET v3 | natural events incl. storms, fires, volcanoes | open | easy global natural-event markers |
| USGS FDSN / GeoJSON feeds | earthquakes | open | live quake layer |
| NASA FIRMS | active fire/hotspot observations | account/API key for some access | wildfire / thermal anomaly layer |
| Smithsonian GVP | volcano information | public datasets | volcano context |

## Weather / atmosphere / contamination-style layers

| Provider | What it gives you | Access | Best use |
|---|---|---|---|
| Open-Meteo | forecast and historical weather APIs | open/commercial terms by use | quick weather overlay |
| ECMWF / Copernicus CDS | ERA5 and major climate/atmospheric datasets | account/token; dataset terms | high-quality atmospheric analysis |
| Copernicus Atmosphere Monitoring Service (CAMS) | air quality, aerosols, atmospheric composition | CDS/ADS access | contamination / plume context |
| NOAA / NWS | US weather alerts/radar/forecast datasets | open | US severe weather |
| RainViewer | radar tiles | key/terms | visual precipitation radar |
| Tomorrow.io / Meteomatics | commercial global weather layers | key/commercial | enterprise weather/nowcasting |

For a cloud/satellite look, use actual satellite/raster products or weather tiles rather than styling country polygons to imply observations.

## Cybersecurity

| Provider | What it gives you | Access | Best use |
|---|---|---|---|
| CISA KEV | known exploited vulnerabilities | public JSON/CSV | critical exploit layer/ticker |
| NVD CVE API | CVE records/CVSS/CPE references | public; API key improves limits | vulnerability detail |
| FIRST EPSS | exploit probability scores | open API/data | prioritization metric |
| AlienVault OTX | threat indicators/pulses | key | threat intel enrichment |
| Abuse.ch feeds | malware/botnet indicators | public/terms | threat map aggregates |

Do not plot individual victim IPs or infer exact cyberattack locations from weak geolocation. Aggregate by region/provider and show uncertainty.

## Sanctions / policy / regulatory context

| Provider | What it gives you | Access | Best use |
|---|---|---|---|
| US Treasury OFAC Sanctions List Service | SDN + consolidated lists, downloadable structured data | public | official US sanctions source |
| EU consolidated financial sanctions / EU Sanctions Map | EU restrictive measures | public | EU sanctions context |
| UK Sanctions List | UK designations | public | UK context |
| UN Security Council Consolidated List | UN designations | public | UN sanctions context |

Normalize sanctions as **designation records**: authority, list/program, subject, aliases, identifiers, effective/update dates, source URL. Never collapse multiple authorities into a single unsupported “sanctioned=yes” flag.

## Economics / country intelligence

| Provider | What it gives you | Access | Best use |
|---|---|---|---|
| World Bank Indicators API v2 | ~16k indicators, long time series, no key | open | population, GDP, debt-related indicators, development metrics |
| IMF APIs/data | macroeconomic/financial statistics | varies by service | debt, FX, fiscal and monetary context |
| OECD Data Explorer APIs | economic/social indicators | open/terms | OECD-country indicators |
| UN Comtrade | international trade flows | key/quotas | commodity/trade dependencies |
| Eurostat API | EU indicators | open | EU regional/economic detail |
| FRED API | US/global economic series | key | markets/economics charts |

## Markets / commodities

Use licensed market data if you want the screenshot-style top ticker. Options: Polygon.io, Twelve Data, Alpha Vantage, Financial Modeling Prep, Nasdaq Data Link, Refinitiv/LSEG, Bloomberg enterprise feeds. Real-time exchange data can have exchange-specific redistribution fees.

## Energy / infrastructure / chokepoints

- EIA Open Data API: production, consumption, inventories and energy statistics.
- ENTSO-E Transparency Platform: European electricity generation/load/interconnectors.
- Global Energy Monitor datasets: plants/pipelines/projects (licensing varies).
- OpenInfraMap / OpenStreetMap: infrastructure geometry (quality varies).
- Marine AIS + geofences: derive Hormuz/Suez/Bab-el-Mandeb/Panama transit counts.

## Fires / remote sensing / earth observation

- NASA FIRMS (VIIRS/MODIS hotspots)
- Sentinel Hub / Copernicus Data Space Ecosystem APIs (Sentinel imagery/catalogue)
- NASA Earthdata APIs
- Planet / Maxar (commercial, high resolution)
- Google Earth Engine (analysis platform; terms and access model differ from a raw tile API)

## Geospatial base / 3D rendering

| Stack | Role |
|---|---|
| CesiumJS | true 3D globe, 3D Tiles, terrain, time-dynamic entities |
| Mapbox GL JS | polished web map + globe projection, vector/raster layers |
| MapLibre GL JS | open-source map renderer; useful when avoiding Mapbox runtime dependency |
| OpenStreetMap | streets/place data; attribution required |
| Natural Earth | country/border baseline datasets |
| Cesium ion / Mapbox / Stadia / Protomaps | basemap/terrain/vector tile hosting options |

## Borders / administrative shapes / place search

- Natural Earth for low/medium resolution global borders.
- geoBoundaries / GADM for detailed admin boundaries (check licences).
- OSM Nominatim or commercial geocoders for place search.
- GeoNames for place hierarchy/alternate names.

## Space / satellites (optional but natural for this product)

- CelesTrak GP/TLE data and Space-Track.org for orbit elements (Space-Track requires account/terms).
- ESA/NASA public mission APIs and catalogs.
- Propagate TLE/GP data locally with SGP4 and render time-dynamic orbits in Cesium.

## Recommended source tiers

### Tier A — launch immediately / low-friction
OpenSky, NASA EONET, USGS, GDELT, World Bank, Wikidata/Wikimedia, CISA KEV, NVD, Open-Meteo, OSM/Natural Earth.

### Tier B — account / contractual integration
ACLED, ReliefWeb approved appname, NASA FIRMS, Copernicus CDS/CAMS, UN Comtrade, market-data API.

### Tier C — commercial detail
MarineTraffic/Spire, FlightAware/ADS-B Exchange, Event Registry/Diffbot, Sentinel Hub/Planet/Maxar, enterprise market feeds.

## What “global all countries, all public-news people” realistically means

You cannot guarantee literal completeness. The correct product claim is **broad global coverage with explicit source coverage and freshness**. Build a coverage dashboard showing last ingest, language/country coverage, provider health, known gaps and data rights. That is much more defensible than implying total surveillance of the planet.
