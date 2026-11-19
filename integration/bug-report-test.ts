import { test, expect } from "@playwright/test";

import { PlaywrightFixture } from "./helpers/playwright-fixture.js";
import type { Fixture, AppFixture } from "./helpers/create-fixture.js";
import {
  createAppFixture,
  createFixture,
  js,
} from "./helpers/create-fixture.js";

let fixture: Fixture;
let appFixture: AppFixture;

////////////////////////////////////////////////////////////////////////////////
// 👋 Hola! I'm here to help you write a great bug report pull request.
//
// You don't need to fix the bug, this is just to report one.
//
// The pull request you are submitting is supposed to fail when created, to let
// the team see the erroneous behavior, and understand what's going wrong.
//
// If you happen to have a fix as well, it will have to be applied in a subsequent
// commit to this pull request, and your now-succeeding test will have to be moved
// to the appropriate file.
//
// First, make sure to install dependencies and build React Router. From the root of
// the project, run this:
//
//    ```
//    pnpm install && pnpm build
//    ```
//
// If you have never installed playwright on your system before, you may also need
// to install a browser engine:
//
//    ```
//    pnpm exec playwright install chromium
//    ```
//
// Now try running this test:
//
//    ```
//    pnpm test:integration bug-report --project chromium
//    ```
//
// You can add `--watch` to the end to have it re-run on file changes:
//
//    ```
//    pnpm test:integration bug-report --project chromium --watch
//    ```
////////////////////////////////////////////////////////////////////////////////

test.beforeEach(async ({ context }) => {
  await context.route(/\.data$/, async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 50));
    route.continue();
  });
});

test.beforeAll(async () => {
  fixture = await createFixture({
    ////////////////////////////////////////////////////////////////////////////
    // 💿 Next, add files to this object, just like files in a real app,
    // `createFixture` will make an app and run your tests against it.
    ////////////////////////////////////////////////////////////////////////////
    files: {
      "app/styled.css": `.styled { color: rebeccapurple; }`,

      "app/routes/_index.tsx": js`
        import { Link } from "react-router";

        export default function Index() {
          return (
            <div>
              <p>home page</p>
              <Link to="/styled">Styled</Link>
            </div>
          );
        }
      `,

      // Its loader redirects once the "session" cookie says the session ended.
      "app/routes/styled.tsx": js`
        import { Link, redirect } from "react-router";
        import "../styled.css";

        export function loader({ request }) {
          if (request.headers.get("Cookie")?.includes("session=ended")) {
            throw redirect("/login");
          }
          return null;
        }

        export default function Styled() {
          return (
            <div className="styled">
              <p>styled page</p>
              <Link to="/">Home</Link>
            </div>
          );
        }
      `,

      "app/routes/login.tsx": js`
        export default function Login() {
          return <p>login page</p>;
        }
      `,
    },
  });

  // This creates an interactive app using playwright.
  appFixture = await createAppFixture(fixture);
});

test.afterAll(() => {
  appFixture.close();
});

////////////////////////////////////////////////////////////////////////////////
// 💿 Almost done, now write your failing test case(s) down here Make sure to
// add a good description for what you expect React Router to do 👇🏽
////////////////////////////////////////////////////////////////////////////////

test("a loader redirect thrown while the route's stylesheet preloads is not an unhandled rejection", async ({
  page,
  context,
}) => {
  let app = new PlaywrightFixture(appFixture, page);
  await page.addInitScript(() => {
    (window as any).__unhandled = [];
    window.addEventListener("unhandledrejection", (event) => {
      let reason = event.reason;
      (window as any).__unhandled.push(
        reason instanceof Response
          ? `Response ${reason.status} to ${reason.headers.get("Location")}`
          : String(reason),
      );
    });
  });

  // Visit /styled, then go back. Its route module stays in the module cache,
  // but its <link rel="stylesheet"> leaves the document.
  await app.goto("/");
  await app.clickLink("/styled");
  await page.waitForSelector("text=styled page");
  await app.clickLink("/");
  await page.waitForSelector("text=home page");

  // End the session, and make the stylesheet load slower than the loader's
  // .data response (as when the browser revalidates it after a tab sat idle).
  await context.addCookies([
    { name: "session", value: "ended", url: appFixture.serverUrl },
  ]);
  let cdp = await context.newCDPSession(page);
  await cdp.send("Network.setCacheDisabled", { cacheDisabled: true });
  await page.route(/\.css$/, async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 300));
    await route.continue();
  });

  await app.clickLink("/styled");
  await page.waitForSelector("text=login page");

  expect(await page.evaluate(() => (window as any).__unhandled)).toEqual([]);
});

////////////////////////////////////////////////////////////////////////////////
// 💿 Finally, push your changes to your fork of React Router
// and open a pull request!
////////////////////////////////////////////////////////////////////////////////
