import { AircraftState, NewsItem, WorldEvent } from "@/types/domain";

export const mockAircraft: AircraftState[] = [
  { id:"a1", callsign:"AUA601", country:"Austria", position:{lat:48.3,lon:14.1,alt:10300}, velocityMs:230, headingDeg:72, lastContact:new Date().toISOString() },
  { id:"a2", callsign:"DLH712", country:"Germany", position:{lat:42.4,lon:28.7,alt:11200}, velocityMs:245, headingDeg:118, lastContact:new Date().toISOString() },
  { id:"a3", callsign:"QTR91", country:"Qatar", position:{lat:25.7,lon:55.3,alt:9800}, velocityMs:238, headingDeg:292, lastContact:new Date().toISOString() },
];

export const mockEvents: WorldEvent[] = [
  { id:"e1",kind:"conflict",title:"Security incident cluster",summary:"Demo conflict marker with confidence score.",severity:"critical",occurredAt:new Date().toISOString(),location:{lat:50.45,lon:30.52},countryCode:"UA",source:"demo",confidence:.93,tags:["conflict","alert"] },
  { id:"e2",kind:"disaster",title:"Wildfire observation",severity:"warning",occurredAt:new Date().toISOString(),location:{lat:37.1,lon:36.7},countryCode:"TR",source:"demo",confidence:.88,tags:["wildfire"] },
  { id:"e3",kind:"maritime",title:"Strait traffic anomaly",severity:"watch",occurredAt:new Date().toISOString(),location:{lat:26.5,lon:56.3},countryCode:"OM",source:"demo",confidence:.84,tags:["shipping"] },
  { id:"e4",kind:"cyber",title:"Critical exploited vulnerability spike",severity:"warning",occurredAt:new Date().toISOString(),location:{lat:38.9,lon:-77.0},countryCode:"US",source:"demo",confidence:.76,tags:["cyber"] }
];

export const mockNews: NewsItem[] = [
  { id:"n1",title:"Regional leaders meet amid new security talks",source:"Demo Wire",publishedAt:new Date().toISOString(),countryCode:"TR",people:["Public official A","Public official B"],themes:["diplomacy","security"],location:{lat:39.9,lon:32.8}},
  { id:"n2",title:"Markets watch shipping conditions through strategic chokepoint",source:"Demo Markets",publishedAt:new Date().toISOString(),countryCode:"OM",themes:["shipping","energy"],location:{lat:26.5,lon:56.3}},
];
