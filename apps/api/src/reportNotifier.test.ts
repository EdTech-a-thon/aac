import { describe, expect, it } from "vitest";
import { reportEmailBody, type ReportRow } from "./reportNotifier.js";

function report(partial: Partial<ReportRow> = {}): ReportRow {
  return {
    id: "report-1",
    publication_id: "pub-1",
    reporter_id: null,
    reason: "Uses a licensed symbol set.",
    created_at: "2026-08-31T10:00:00.000Z",
    ...partial,
  };
}

const slugs = new Map([
  ["pub-1", "everyday-core-words"],
  ["pub-2", "kitchen-words"],
]);

describe("reportEmailBody", () => {
  it("carries enough to triage without opening the database", () => {
    const body = reportEmailBody([report()], slugs, "https://example.test");
    expect(body).toContain("everyday-core-words");
    expect(body).toContain("Uses a licensed symbol set.");
    expect(body).toContain("https://example.test/gallery/everyday-core-words");
    expect(body).toContain("reported anonymously");
  });

  it("names a signed-in reporter, and says so when there is none", () => {
    const named = reportEmailBody([report({ reporter_id: "user-7" })], slugs, "https://example.test");
    expect(named).toContain("user-7");
    expect(named).not.toContain("reported anonymously");
  });

  it("covers every report in one catch-up rather than one per email", () => {
    const body = reportEmailBody(
      [
        report({ id: "a", reason: "First complaint" }),
        report({ id: "b", publication_id: "pub-2", reason: "Second complaint" }),
      ],
      slugs,
      "https://example.test",
    );
    expect(body).toContain("2 reports have come in");
    expect(body).toContain("First complaint");
    expect(body).toContain("Second complaint");
    expect(body).toContain("kitchen-words");
  });

  it("says plainly that nothing was taken down", () => {
    expect(reportEmailBody([report()], slugs, "https://example.test")).toContain(
      "Nothing has been taken down",
    );
  });

  it("tolerates a Publication whose slug it could not resolve", () => {
    const body = reportEmailBody(
      [report({ publication_id: "pub-missing" })],
      slugs,
      "https://example.test",
    );
    expect(body).toContain("(unknown)");
  });

  it("does not double a slash when the site url has a trailing one", () => {
    const body = reportEmailBody([report()], slugs, "https://example.test/");
    expect(body).toContain("https://example.test/gallery/everyday-core-words");
    expect(body).not.toContain("test//gallery");
  });
});
