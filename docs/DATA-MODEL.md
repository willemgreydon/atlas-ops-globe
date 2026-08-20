# Core data model

```text
Country <-located_in- Place <-located_at- Event -mentions-> Entity(Person|Org)
  |                                |                      |
  |                                +--evidence----------> SourceDocument
  |
  +--indicator_series------------> IndicatorObservation

Asset(Aircraft|Vessel|Satellite|Facility)
  +--track------------------------> TrackPoint[]
  +--registered_in---------------> Country
  +--related_event---------------> Event
```

## Event fields

`id, type, subtype, title, summary, severity, confidence, observedAt, publishedAt, geometry, countries[], entities[], sourceIds[], provenance[], tags[], status`

## Track point fields

`assetId, observedAt, lat, lon, altitude/depth, speed, heading, verticalRate, sourceId, quality`

## Provenance fields

`provider, providerRecordId, sourceUrl, retrievedAt, licenceClass, rawObjectHash, rawObjectUri, transformationVersion`

## Person/public-figure record

`wikidataId, canonicalName, aliases[], occupations[], nationalities[], imageRef?, officialLinks[], currentRoles[], sourceRefs[]`

Never infer sensitive/private attributes. Public-person profiles should be sourced from public records and reputable reporting with provenance.
