export const providerRegistry = {
  aviation: ["OpenSky Network", "FlightAware AeroAPI", "ADS-B Exchange"],
  maritime: ["MarineTraffic", "AISstream", "Spire Maritime", "VesselFinder"],
  news: ["GDELT 2.0", "Event Registry", "NewsAPI", "The Guardian Open Platform"],
  conflict: ["ACLED", "UCDP", "GDELT Events"],
  humanitarian: ["ReliefWeb", "GDACS"],
  naturalHazards: ["NASA EONET", "USGS Earthquakes", "NASA FIRMS", "NOAA/NWS", "Copernicus EMS"],
  cyber: ["CISA KEV", "NVD", "FIRST EPSS", "AlienVault OTX"],
  entities: ["Wikidata", "Wikimedia REST", "Diffbot Knowledge Graph"],
  economics: ["World Bank Indicators", "IMF Data", "UN Comtrade", "OECD"],
  sanctions: ["OFAC SLS", "EU Sanctions Map/Data", "UK Sanctions List"],
  geospatial: ["CesiumJS", "Mapbox GL JS", "MapLibre GL JS", "OpenStreetMap", "Natural Earth"],
} as const;
