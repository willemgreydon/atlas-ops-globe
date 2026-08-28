import { MAJOR_CITIES } from "./cities";

/**
 * City gazetteer for light geolocation of news headlines (mission: put world
 * news on the globe). Country-name matching alone missed headlines that name a
 * *city* ("Beijing", "Lagos", "Sydney") rather than the country — leaving big
 * gaps over Russia, China, Africa and Australia. This adds a distinctive,
 * unambiguous set of world cities → precise coordinates, reusing the weather
 * MAJOR_CITIES set and extending it (weighted to the previously-sparse regions).
 *
 * Names are chosen to avoid collisions with common English words / other places
 * (no "Nice", "Mobile", "Reading", "Split", "Georgia"), so word-boundary
 * matching over a headline stays conservative — we plot nothing rather than
 * misplace.
 */
export interface GazCity {
  name: string;
  iso2: string;
  lat: number;
  lon: number;
  aliases?: string[];
}

const EXTRA: GazCity[] = [
  // Russia (beyond Moscow)
  { name: "Saint Petersburg", iso2: "RU", lat: 59.94, lon: 30.31, aliases: ["St Petersburg", "St. Petersburg"] },
  { name: "Novosibirsk", iso2: "RU", lat: 55.01, lon: 82.93 },
  { name: "Yekaterinburg", iso2: "RU", lat: 56.84, lon: 60.65 },
  { name: "Vladivostok", iso2: "RU", lat: 43.12, lon: 131.89 },
  { name: "Kazan", iso2: "RU", lat: 55.79, lon: 49.12 },
  { name: "Sochi", iso2: "RU", lat: 43.6, lon: 39.73 },
  // China (beyond Beijing/Shanghai/Hong Kong)
  { name: "Guangzhou", iso2: "CN", lat: 23.13, lon: 113.26, aliases: ["Canton"] },
  { name: "Shenzhen", iso2: "CN", lat: 22.54, lon: 114.06 },
  { name: "Chengdu", iso2: "CN", lat: 30.57, lon: 104.07 },
  { name: "Wuhan", iso2: "CN", lat: 30.59, lon: 114.3 },
  { name: "Chongqing", iso2: "CN", lat: 29.56, lon: 106.55 },
  { name: "Xi'an", iso2: "CN", lat: 34.34, lon: 108.94 },
  { name: "Taipei", iso2: "TW", lat: 25.03, lon: 121.57 },
  // Australia / NZ
  { name: "Melbourne", iso2: "AU", lat: -37.81, lon: 144.96 },
  { name: "Brisbane", iso2: "AU", lat: -27.47, lon: 153.03 },
  { name: "Perth", iso2: "AU", lat: -31.95, lon: 115.86 },
  { name: "Canberra", iso2: "AU", lat: -35.28, lon: 149.13 },
  { name: "Adelaide", iso2: "AU", lat: -34.93, lon: 138.6 },
  { name: "Auckland", iso2: "NZ", lat: -36.85, lon: 174.76 },
  { name: "Wellington", iso2: "NZ", lat: -41.29, lon: 174.78 },
  // Africa
  { name: "Cape Town", iso2: "ZA", lat: -33.92, lon: 18.42 },
  { name: "Accra", iso2: "GH", lat: 5.6, lon: -0.19 },
  { name: "Addis Ababa", iso2: "ET", lat: 9.03, lon: 38.74 },
  { name: "Casablanca", iso2: "MA", lat: 33.57, lon: -7.59 },
  { name: "Kinshasa", iso2: "CD", lat: -4.32, lon: 15.31 },
  { name: "Dar es Salaam", iso2: "TZ", lat: -6.79, lon: 39.21 },
  { name: "Khartoum", iso2: "SD", lat: 15.5, lon: 32.56 },
  { name: "Algiers", iso2: "DZ", lat: 36.75, lon: 3.06 },
  { name: "Abuja", iso2: "NG", lat: 9.06, lon: 7.5 },
  { name: "Kampala", iso2: "UG", lat: 0.35, lon: 32.58 },
  { name: "Tripoli", iso2: "LY", lat: 32.89, lon: 13.19 },
  { name: "Tunis", iso2: "TN", lat: 36.81, lon: 10.18 },
  { name: "Dakar", iso2: "SN", lat: 14.72, lon: -17.47 },
  { name: "Harare", iso2: "ZW", lat: -17.83, lon: 31.05 },
  { name: "Mogadishu", iso2: "SO", lat: 2.05, lon: 45.34 },
  // Middle East / Central & South Asia
  { name: "Doha", iso2: "QA", lat: 25.29, lon: 51.53 },
  { name: "Jeddah", iso2: "SA", lat: 21.49, lon: 39.19 },
  { name: "Kuwait City", iso2: "KW", lat: 29.38, lon: 47.99 },
  { name: "Amman", iso2: "JO", lat: 31.95, lon: 35.93 },
  { name: "Baghdad", iso2: "IQ", lat: 33.31, lon: 44.36 },
  { name: "Beirut", iso2: "LB", lat: 33.89, lon: 35.5 },
  { name: "Damascus", iso2: "SY", lat: 33.51, lon: 36.29 },
  { name: "Jerusalem", iso2: "IL", lat: 31.77, lon: 35.21 },
  { name: "Tel Aviv", iso2: "IL", lat: 32.08, lon: 34.78 },
  { name: "Sanaa", iso2: "YE", lat: 15.37, lon: 44.19 },
  { name: "Ankara", iso2: "TR", lat: 39.93, lon: 32.86 },
  { name: "Kabul", iso2: "AF", lat: 34.56, lon: 69.21 },
  { name: "Islamabad", iso2: "PK", lat: 33.68, lon: 73.05 },
  { name: "Colombo", iso2: "LK", lat: 6.93, lon: 79.86 },
  // East / SE Asia
  { name: "Osaka", iso2: "JP", lat: 34.69, lon: 135.5 },
  { name: "Manila", iso2: "PH", lat: 14.6, lon: 120.98 },
  { name: "Kuala Lumpur", iso2: "MY", lat: 3.14, lon: 101.69 },
  { name: "Hanoi", iso2: "VN", lat: 21.03, lon: 105.85 },
  { name: "Ho Chi Minh City", iso2: "VN", lat: 10.82, lon: 106.63, aliases: ["Saigon"] },
  { name: "Yangon", iso2: "MM", lat: 16.87, lon: 96.2, aliases: ["Rangoon"] },
  { name: "Phnom Penh", iso2: "KH", lat: 11.56, lon: 104.92 },
  // Europe
  { name: "Amsterdam", iso2: "NL", lat: 52.37, lon: 4.9 },
  { name: "Brussels", iso2: "BE", lat: 50.85, lon: 4.35 },
  { name: "Warsaw", iso2: "PL", lat: 52.23, lon: 21.01 },
  { name: "Athens", iso2: "GR", lat: 37.98, lon: 23.73 },
  { name: "Stockholm", iso2: "SE", lat: 59.33, lon: 18.06 },
  { name: "Lisbon", iso2: "PT", lat: 38.72, lon: -9.14 },
  { name: "Munich", iso2: "DE", lat: 48.14, lon: 11.58 },
  { name: "Milan", iso2: "IT", lat: 45.46, lon: 9.19 },
  { name: "Barcelona", iso2: "ES", lat: 41.39, lon: 2.17 },
  { name: "Dublin", iso2: "IE", lat: 53.35, lon: -6.26 },
  { name: "Copenhagen", iso2: "DK", lat: 55.68, lon: 12.57 },
  { name: "Helsinki", iso2: "FI", lat: 60.17, lon: 24.94 },
  { name: "Budapest", iso2: "HU", lat: 47.5, lon: 19.04 },
  { name: "Prague", iso2: "CZ", lat: 50.08, lon: 14.44 },
  { name: "Bucharest", iso2: "RO", lat: 44.43, lon: 26.1 },
  { name: "Belgrade", iso2: "RS", lat: 44.79, lon: 20.45 },
  // Americas
  { name: "Washington", iso2: "US", lat: 38.9, lon: -77.04 },
  { name: "San Francisco", iso2: "US", lat: 37.77, lon: -122.42 },
  { name: "Miami", iso2: "US", lat: 25.76, lon: -80.19 },
  { name: "Houston", iso2: "US", lat: 29.76, lon: -95.37 },
  { name: "Boston", iso2: "US", lat: 42.36, lon: -71.06 },
  { name: "Seattle", iso2: "US", lat: 47.61, lon: -122.33 },
  { name: "Vancouver", iso2: "CA", lat: 49.28, lon: -123.12 },
  { name: "Bogota", iso2: "CO", lat: 4.71, lon: -74.07, aliases: ["Bogotá"] },
  { name: "Lima", iso2: "PE", lat: -12.05, lon: -77.04 },
  { name: "Santiago", iso2: "CL", lat: -33.45, lon: -70.67 },
  { name: "Rio de Janeiro", iso2: "BR", lat: -22.91, lon: -43.17 },
  { name: "Brasilia", iso2: "BR", lat: -15.79, lon: -47.88, aliases: ["Brasília"] },
  { name: "Caracas", iso2: "VE", lat: 10.48, lon: -66.9 },
  { name: "Havana", iso2: "CU", lat: 23.11, lon: -82.37 },
  // --- Deeper RU/CN/AF coverage (mission: fill the sparse regions) ---
  // Russia (beyond the capitals already above)
  { name: "Rostov-on-Don", iso2: "RU", lat: 47.24, lon: 39.71 },
  { name: "Krasnodar", iso2: "RU", lat: 45.04, lon: 38.98 },
  { name: "Samara", iso2: "RU", lat: 53.2, lon: 50.15 },
  { name: "Ufa", iso2: "RU", lat: 54.74, lon: 55.97 },
  { name: "Volgograd", iso2: "RU", lat: 48.71, lon: 44.51 },
  { name: "Krasnoyarsk", iso2: "RU", lat: 56.01, lon: 92.87 },
  { name: "Irkutsk", iso2: "RU", lat: 52.29, lon: 104.3 },
  { name: "Omsk", iso2: "RU", lat: 54.99, lon: 73.37 },
  { name: "Chelyabinsk", iso2: "RU", lat: 55.16, lon: 61.4 },
  { name: "Nizhny Novgorod", iso2: "RU", lat: 56.3, lon: 43.94 },
  { name: "Murmansk", iso2: "RU", lat: 68.97, lon: 33.08 },
  // China (beyond those already above)
  { name: "Nanjing", iso2: "CN", lat: 32.06, lon: 118.8 },
  { name: "Hangzhou", iso2: "CN", lat: 30.27, lon: 120.15 },
  { name: "Tianjin", iso2: "CN", lat: 39.14, lon: 117.2 },
  { name: "Shenyang", iso2: "CN", lat: 41.81, lon: 123.43 },
  { name: "Harbin", iso2: "CN", lat: 45.8, lon: 126.53 },
  { name: "Kunming", iso2: "CN", lat: 25.04, lon: 102.71 },
  { name: "Changsha", iso2: "CN", lat: 28.23, lon: 112.94 },
  { name: "Zhengzhou", iso2: "CN", lat: 34.75, lon: 113.63 },
  { name: "Qingdao", iso2: "CN", lat: 36.07, lon: 120.38 },
  { name: "Dalian", iso2: "CN", lat: 38.91, lon: 121.61 },
  { name: "Xiamen", iso2: "CN", lat: 24.48, lon: 118.09 },
  { name: "Urumqi", iso2: "CN", lat: 43.83, lon: 87.62 },
  { name: "Lhasa", iso2: "CN", lat: 29.65, lon: 91.13 },
  // Africa (beyond those already above)
  { name: "Kano", iso2: "NG", lat: 12.0, lon: 8.52 },
  { name: "Ibadan", iso2: "NG", lat: 7.38, lon: 3.9 },
  { name: "Abidjan", iso2: "CI", lat: 5.36, lon: -4.01 },
  { name: "Kumasi", iso2: "GH", lat: 6.69, lon: -1.62 },
  { name: "Douala", iso2: "CM", lat: 4.05, lon: 9.7 },
  { name: "Luanda", iso2: "AO", lat: -8.84, lon: 13.23 },
  { name: "Maputo", iso2: "MZ", lat: -25.97, lon: 32.57 },
  { name: "Lusaka", iso2: "ZM", lat: -15.42, lon: 28.28 },
  { name: "Bamako", iso2: "ML", lat: 12.64, lon: -8.0 },
  { name: "Ouagadougou", iso2: "BF", lat: 12.37, lon: -1.53 },
  { name: "Kigali", iso2: "RW", lat: -1.94, lon: 30.06 },
  { name: "Antananarivo", iso2: "MG", lat: -18.88, lon: 47.51 },
  { name: "Mombasa", iso2: "KE", lat: -4.04, lon: 39.67 },
  { name: "Marrakech", iso2: "MA", lat: 31.63, lon: -8.01 },
  { name: "Freetown", iso2: "SL", lat: 8.48, lon: -13.23 },
  { name: "Conakry", iso2: "GN", lat: 9.64, lon: -13.58 },
  { name: "Juba", iso2: "SS", lat: 4.85, lon: 31.58 },
  { name: "Windhoek", iso2: "NA", lat: -22.56, lon: 17.08 },
  { name: "Gaborone", iso2: "BW", lat: -24.63, lon: 25.91 },
];

/** Merged gazetteer: weather cities (reused, DRY) + the extended set. */
export const WORLD_CITIES: GazCity[] = [
  ...MAJOR_CITIES.map((c) => ({ name: c.name, iso2: c.iso2, lat: c.point.lat, lon: c.point.lon })),
  ...EXTRA,
];
