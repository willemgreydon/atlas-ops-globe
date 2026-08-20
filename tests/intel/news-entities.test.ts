import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { normalizeEventRegistry } from "@/lib/intel/providers/eventregistry";
import { normalizeNewsApi } from "@/lib/intel/providers/newsapi";
import { VaultNews, VaultOrganization, VaultPerson } from "@/lib/intel/schemas";

const erFixture = JSON.parse(
  readFileSync(resolve(__dirname, "..", "fixtures", "eventregistry.sample.json"), "utf8"),
);

describe("Event Registry entity extraction", () => {
  const [article] = normalizeEventRegistry(erFixture);

  it("extracts persons and organizations above the score threshold", () => {
    expect(article.persons.map((p) => p.canonicalName).sort()).toEqual(["Vladimir Putin", "Volodymyr Zelenskyy"]);
    expect(article.organizations.map((o) => o.canonicalName)).toEqual(["NATO"]);
    // low-score concept dropped
    expect(article.persons.find((p) => p.canonicalName === "Ignored Low Score")).toBeUndefined();
  });

  it("mints Wikipedia-based ids and validates the schemas", () => {
    const putin = article.persons.find((p) => p.canonicalName === "Vladimir Putin")!;
    expect(putin.id).toBe("person:wiki-Vladimir_Putin");
    expect(putin.wikipediaUrl).toContain("Vladimir_Putin");
    expect(() => VaultPerson.parse(putin)).not.toThrow();
    expect(() => VaultOrganization.parse(article.organizations[0])).not.toThrow();
  });

  it("resolves article country and links entity names into the article", () => {
    expect(article.news.countryCode).toBe("UA");
    expect(article.news.persons).toContain("Vladimir Putin");
    expect(() => VaultNews.parse(article.news)).not.toThrow();
  });
});

describe("NewsAPI normalization", () => {
  it("maps articles and infers country from headline mentions", () => {
    const news = normalizeNewsApi({
      status: "ok",
      articles: [
        { source: { name: "BBC" }, title: "Germany and France sign new treaty", url: "https://x.test/g", publishedAt: "2026-08-20T08:00:00Z" },
        { source: { name: "AP" }, title: "Markets rally", url: "https://x.test/m", publishedAt: "2026-08-20T07:00:00Z" },
      ],
    });
    expect(news).toHaveLength(2);
    expect(news[0].countryCode).toBe("DE"); // first mention
    expect(news[0].provenance[0].provider).toBe("newsapi");
    expect(() => VaultNews.parse(news[0])).not.toThrow();
  });
});
