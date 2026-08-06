import { describe, expect, it } from "vitest";

import { getSessionCookieOptions } from "./cookies";

describe("getSessionCookieOptions", () => {
  it.each(["localhost:3000", "127.0.0.1:5173"])(
    "allows an insecure Lax cookie for local host %s",
    (host) => {
      const options = getSessionCookieOptions(new Headers({ host }));

      expect(options).toEqual({
        httpOnly: true,
        path: "/",
        sameSite: "Lax",
        secure: false,
      });
    },
  );

  it("requires a secure cross-site cookie outside localhost", () => {
    const options = getSessionCookieOptions(
      new Headers({ host: "app.tashira.example" }),
    );

    expect(options).toEqual({
      httpOnly: true,
      path: "/",
      sameSite: "None",
      secure: true,
    });
  });
});
