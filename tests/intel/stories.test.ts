import { describe, expect, it } from "vitest";
import { clusterStories, titleTokens } from "@/lib/intel/stories";

describe("story clustering", () => {
  it("tokenizes titles dropping stopwords and punctuation", () => {
    const t = titleTokens("The earthquake hits Japan, again!");
    expect(t.has("earthquake")).toBe(true);
    expect(t.has("japan")).toBe(true);
    expect(t.has("the")).toBe(false);
  });

  it("groups near-duplicate headlines into one story", () => {
    const titles = [
      "Major earthquake strikes northern Japan coast",
      "Earthquake strikes northern Japan coast, tsunami warning",
      "Global markets rally on tech earnings",
    ];
    const assign = clusterStories(titles, 0.4);
    expect(assign.get(0)).toBe(assign.get(1)); // same story
    expect(assign.get(0)).not.toBe(assign.get(2)); // different story
  });

  it("keeps unrelated headlines in separate stories", () => {
    const assign = clusterStories(["Floods in Brazil", "Cyber advisory issued for routers"]);
    expect(assign.get(0)).not.toBe(assign.get(1));
  });
});
