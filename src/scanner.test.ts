import { describe, expect, it } from "vitest";
import { contentIssues, pathIssues, safeArchivePath, scanFile } from "./scanner";

describe("path checks", () => {
  it("blocks real env files but allows examples", () => {
    expect(pathIssues("project/.env.local").some((issue) => issue.code === "env-file")).toBe(true);
    expect(pathIssues("project/.env.example").some((issue) => issue.code === "env-file")).toBe(false);
  });

  it("flags junk and databases", () => {
    expect(pathIssues("project/node_modules/pkg/index.js").map((issue) => issue.code)).toContain("generated-junk");
    expect(pathIssues("project/data/users.sqlite").map((issue) => issue.code)).toContain("local-database");
  });

  it("blocks traversal paths and makes their export names safe", () => {
    expect(pathIssues("../../private.txt").map((issue) => issue.code)).toContain("unsafe-path");
    expect(safeArchivePath("../../private.txt")).toBe("private.txt");
    expect(safeArchivePath("C:\\Users\\Jamie\\file.txt")).toBe("Users/Jamie/file.txt");
  });
});

describe("content checks", () => {
  it("recognizes credential families without returning their values", () => {
    const issues = contentIssues("OPENAI_API_KEY=sk-proj-abcdefghijklmnopqrstuvwxyz123456");
    expect(issues.map((issue) => issue.code)).toContain("openai-key");
    expect(JSON.stringify(issues)).not.toContain("abcdefghijklmnopqrstuvwxyz123456");
  });

  it("flags personal home paths", () => {
    expect(contentIssues("cache = C:\\Users\\Jamie\\Desktop\\test").map((issue) => issue.code)).toContain("personal-path");
    expect(contentIssues("cache = C:\\\\Users\\\\Jamie\\\\Desktop").map((issue) => issue.code)).toContain("personal-path");
  });
});

describe("file scan", () => {
  it("defaults risky files to excluded", async () => {
    const result = await scanFile(new File(["TOKEN=passwordvalue123456789"], ".env"), "demo/.env");
    expect(result.excluded).toBe(true);
    expect(result.issues.length).toBeGreaterThan(0);
  });
});
