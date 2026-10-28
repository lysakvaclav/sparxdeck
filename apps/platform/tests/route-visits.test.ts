import { describe, expect, it } from "vitest";
import { markVisit, parseQueue, withMarks } from "@/lib/route-visits";

// Stops marked visited without a signal (part 23): what waits, and what the phone shows.

const at = "2026-11-02T09:15:00.000Z";

describe("the queue of visits", () => {
  it("keeps a change from the server's state, forgets a change back", () => {
    let queue = markVisit({}, "a", true, at, false);
    expect(queue).toEqual({ a: { visited: true, at } });
    queue = markVisit(queue, "a", false, at, false);
    expect(queue).toEqual({});
    // Unmarking a stop the server has as visited waits too.
    expect(markVisit({}, "b", false, at, true)).toEqual({ b: { visited: false, at } });
  });

  it("shows the waiting marks over the server's state", () => {
    const stops = [
      { id: "a", visitedAt: null },
      { id: "b", visitedAt: "2026-11-02T08:00:00.000Z" },
      { id: "c", visitedAt: null },
    ];
    const shown = withMarks(stops, { a: { visited: true, at }, b: { visited: false, at } });
    expect(shown.map((stop) => [stop.id, stop.visitedAt, stop.waiting])).toEqual([
      ["a", at, true],
      ["b", null, true],
      ["c", null, false],
    ]);
  });

  it("reads only well-formed entries from storage", () => {
    expect(parseQueue(null)).toEqual({});
    expect(parseQueue("not json")).toEqual({});
    expect(parseQueue("[1,2]")).toEqual({});
    expect(
      parseQueue(
        JSON.stringify({
          a: { visited: true, at },
          b: { visited: "yes", at },
          c: { visited: false, at: "yesterday" },
          d: null,
        }),
      ),
    ).toEqual({ a: { visited: true, at } });
  });
});
