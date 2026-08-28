import { describe, it, expect } from "vitest";
import { messageToVessel } from "@/lib/providers/aisstream";

const NOW = "2026-08-28T09:00:00.000Z";

describe("messageToVessel", () => {
  it("maps a PositionReport into a VesselRow", () => {
    const v = messageToVessel(
      {
        MetaData: { MMSI: 244660000, ShipName: "KRVE 11  ", latitude: 51.88, longitude: 4.27 },
        Message: { PositionReport: { Sog: 12.3, Cog: 90, NavigationalStatus: 0 } },
      },
      NOW,
    );
    expect(v).toMatchObject({
      id: "vessel:244660000",
      mmsi: "244660000",
      name: "KRVE 11",
      lat: 51.88,
      lon: 4.27,
      speedKn: 12.3,
      courseDeg: 90,
      navigationStatus: "under way (engine)",
      lastContact: NOW,
    });
  });

  it("returns null without valid coordinates or MMSI", () => {
    expect(messageToVessel({ MetaData: { MMSI: 1, latitude: 51 } }, NOW)).toBeNull(); // no lon
    expect(messageToVessel({ MetaData: { latitude: 1, longitude: 2 } }, NOW)).toBeNull(); // no MMSI
    expect(messageToVessel({}, NOW)).toBeNull();
  });

  it("tolerates a missing PositionReport (speed/course null)", () => {
    const v = messageToVessel({ MetaData: { MMSI: 5, latitude: 1, longitude: 2 } }, NOW);
    expect(v).toMatchObject({ speedKn: null, courseDeg: null });
    expect(v?.navigationStatus).toBeUndefined();
  });
});
