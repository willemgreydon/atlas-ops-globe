import { describe, it, expect } from "vitest";
import { parseFirmsCsv } from "@/lib/providers/firms";

const HEADER = "latitude,longitude,bright_ti4,scan,track,acq_date,acq_time,satellite,instrument,confidence,version,bright_ti5,frp,daynight";

describe("parseFirmsCsv", () => {
  it("parses rows by column name into fire points with an ISO timestamp", () => {
    const csv = [
      HEADER,
      "-2.5,34.1,330.1,0.4,0.4,2026-08-27,0512,N,VIIRS,h,2.0NRT,295.0,42.7,D",
      "61.2,90.4,367.0,0.5,0.5,2026-08-27,2130,N,VIIRS,n,2.0NRT,300.1,180.5,N",
    ].join("\n");
    const fires = parseFirmsCsv(csv);
    expect(fires).toHaveLength(2);
    expect(fires[0]).toMatchObject({ lat: -2.5, lon: 34.1, frp: 42.7, confidence: "h", dayNight: "D" });
    expect(fires[0].acquiredAt).toBe("2026-08-27T05:12:00Z");
    expect(fires[1].acquiredAt).toBe("2026-08-27T21:30:00Z"); // Siberia, high FRP
  });

  it("tolerates column reordering and missing optional columns", () => {
    const csv = ["longitude,latitude,acq_date,acq_time", "10,20,2026-08-27,900"].join("\n");
    const fires = parseFirmsCsv(csv);
    expect(fires).toHaveLength(1);
    expect(fires[0]).toMatchObject({ lat: 20, lon: 10, frp: null });
    expect(fires[0].acquiredAt).toBe("2026-08-27T09:00:00Z"); // acq_time padded
  });

  it("drops rows without finite coordinates and returns [] for junk", () => {
    expect(parseFirmsCsv("")).toEqual([]);
    expect(parseFirmsCsv("not,a,fire,csv")).toEqual([]);
    const csv = [HEADER, ",,,,,2026-08-27,0000,N,VIIRS,h,2,,10,D"].join("\n");
    expect(parseFirmsCsv(csv)).toHaveLength(0);
  });
});
