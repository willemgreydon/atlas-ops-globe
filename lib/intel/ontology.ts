/**
 * Intelligence ontology: the controlled vocabulary of entity and relation types
 * used across every domain. Structured so it can be emitted to JSON
 * (intelligence/_core/ontology/*.json) and later mapped onto a graph database.
 */

export const ENTITY_TYPES = [
  // Geography
  "Country", "Region", "City", "Location",
  // People & organizations
  "Person", "PublicFigure", "Organization", "Company",
  "GovernmentOrganization", "MilitaryOrganization", "InternationalOrganization",
  // Events
  "Event", "ConflictEvent", "PoliticalEvent", "DisasterEvent", "CyberEvent", "EconomicEvent",
  // Aviation
  "Aircraft", "Flight", "Airport", "Airline",
  // Maritime
  "Vessel", "Voyage", "Port",
  // Infrastructure & energy
  "InfrastructureAsset", "EnergyAsset",
  // Information
  "NewsArticle", "NewsStory", "Publication",
  // Governance & economics
  "Sanction", "Regulation", "EconomicIndicator", "MarketInstrument", "MarketObservation",
  // Environment
  "WeatherObservation", "EnvironmentalObservation",
  // Space
  "Satellite", "SpaceObject", "Orbit", "GroundStation",
] as const;

export type EntityType = (typeof ENTITY_TYPES)[number];

export const RELATION_TYPES = [
  "LOCATED_IN", "OCCURRED_IN", "MENTIONS", "INVOLVES", "RELATED_TO",
  "OPERATED_BY", "OWNED_BY", "REGISTERED_IN", "FLAGGED_IN",
  "DEPARTED_FROM", "ARRIVED_AT", "SANCTIONED_BY", "SUBJECT_TO",
  "MEMBER_OF", "HEAD_OF", "GOVERNS", "TRADES_WITH",
  "AFFECTED_BY", "NEAR", "OVERLAPS", "OBSERVED_BY", "SOURCE_OF",
] as const;

export type RelationType = (typeof RELATION_TYPES)[number];

/**
 * How a relationship was established — a first-class field so we never present
 * an inferred/near link as a hard fact.
 */
export const RELATIONSHIP_BASIS = [
  "direct",
  "reported",
  "spatially-near",
  "temporally-related",
  "entity-overlap",
  "inferred-low-confidence",
] as const;

export type RelationshipBasis = (typeof RELATIONSHIP_BASIS)[number];

export const INTELLIGENCE_DOMAINS = [
  "global", "conflict", "aviation", "maritime", "news", "politics", "economics",
  "markets", "energy", "infrastructure", "environment", "weather", "disasters",
  "cyber", "sanctions", "space",
] as const;

export type IntelligenceDomain = (typeof INTELLIGENCE_DOMAINS)[number];

export const ontology = {
  version: "1.0.0",
  entityTypes: ENTITY_TYPES,
  relationTypes: RELATION_TYPES,
  relationshipBasis: RELATIONSHIP_BASIS,
  domains: INTELLIGENCE_DOMAINS,
};
