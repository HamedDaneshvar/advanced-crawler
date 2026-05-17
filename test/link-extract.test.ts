import { chromium } from "playwright";

import { extractAllLinks } from "../src/core/linkExtractor.js";

const SAMPLE_HTML = `
<!DOCTYPE html>
<html>
<head>
  <base href="https://bytebytego.com/" />
</head>

<body>
  <div class="style-module-scss-module__lSxgaq__courseList">

    <!-- onclick navigation -->
    <a
      class="style-module-scss-module__lSxgaq__courseImg"
      onclick="window.location='/courses/coding-patterns'"
    >
      <img alt="Coding Interview Patterns" />
    </a>

    <!-- data-href navigation -->
    <a
      class="style-module-scss-module__lSxgaq__courseImg"
      data-href="/courses/system-design-interview"
    >
      <img alt="System Design" />
    </a>

    <!-- normal href -->
    <a
      class="style-module-scss-module__lSxgaq__courseImg"
      href="/courses/tech-resume"
    >
      <img alt="Tech Resume" />
    </a>

    <!-- react-style route -->
    <div
      role="link"
      data-url="/courses/react-performance"
    >
      React Performance
    </div>

    <!-- next.js simulated -->
    <script id="__NEXT_DATA__" type="application/json">
      {
        "props": {
          "pageProps": {
            "courses": [
              {
                "slug": "/courses/system-design"
              },
              {
                "slug": "/courses/microservices"
              }
            ]
          }
        }
      }
    </script>

  </div>
</body>
</html>
`;

(async () => {
  const browser = await chromium.launch({
    headless: true,
  });

  const context = await browser.newContext();

  const page = await context.newPage();

  // =======================================================
  // LOAD TEST HTML
  // =======================================================

  await page.setContent(SAMPLE_HTML, {
    waitUntil: "domcontentloaded",
  });

  console.log(
    "\n================================================="
  );

  console.log("PAGE URL");

  console.log(
    "=================================================\n"
  );

  console.log(page.url());

  // =======================================================
  // DEBUG RAW ELEMENTS
  // =======================================================

  const debug = await page.$$eval(
    "a",
    (anchors) => {
      return anchors.map((a) => ({
        runtimeHref:
          (a as HTMLAnchorElement).href,

        attributeHref:
          a.getAttribute("href"),

        onclick:
          a.getAttribute("onclick"),

        dataHref:
          a.getAttribute("data-href"),
      }));
    }
  );

  console.log(
    "\n================================================="
  );

  console.log("ANCHOR DEBUG");

  console.log(
    "=================================================\n"
  );

  console.dir(debug, {
    depth: null,
  });

  // =======================================================
  // MANUAL EVALUATION TEST
  // =======================================================

  const evalLinks = await page.evaluate(() => {
    const found = new Set<string>();

    const add = (url?: string | null) => {
      if (!url) return;

      try {
        found.add(
          new URL(
            url,
            window.location.href
          ).href
        );
      } catch {
        //
      }
    };

    // ===============================================
    // NORMAL A TAGS
    // ===============================================

    const anchors =
      document.querySelectorAll("a");

    for (const anchor of anchors) {
      // IMPORTANT:
      // runtime .href NOT getAttribute("href")

      const href = (
        anchor as HTMLAnchorElement
      ).href;

      add(href);

      const dataHref =
        anchor.getAttribute(
          "data-href"
        );

      add(dataHref);

      const onclick =
        anchor.getAttribute(
          "onclick"
        );

      if (onclick) {
        const patterns = [
          /window\.location\s*=\s*['"](.*?)['"]/,
          /window\.location\.href\s*=\s*['"](.*?)['"]/,
          /navigate\(['"](.*?)['"]\)/,
          /router\.push\(['"](.*?)['"]\)/,
          /location\.href\s*=\s*['"](.*?)['"]/,
        ];

        for (const pattern of patterns) {
          const match =
            onclick.match(pattern);

          if (match?.[1]) {
            add(match[1]);
          }
        }
      }
    }

    // ===============================================
    // NEXT DATA
    // ===============================================

    const nextData =
      document.querySelector(
        "#__NEXT_DATA__"
      );

    if (nextData?.textContent) {
      try {
        const data = JSON.parse(
          nextData.textContent
        );

        const walk = (obj: any) => {
          if (!obj) return;

          if (
            typeof obj === "string"
          ) {
            if (
              obj.startsWith("/") ||
              obj.startsWith("http")
            ) {
              add(obj);
            }

            return;
          }

          if (Array.isArray(obj)) {
            obj.forEach(walk);

            return;
          }

          if (
            typeof obj === "object"
          ) {
            Object.values(obj).forEach(
              walk
            );
          }
        };

        walk(data);
      } catch {
        //
      }
    }

    return Array.from(found);
  });

  console.log(
    "\n================================================="
  );

  console.log("MANUAL EVALUATION LINKS");

  console.log(
    "=================================================\n"
  );

  console.dir(evalLinks, {
    depth: null,
  });

  // =======================================================
  // TEST NEW extractAllLinks API
  // =======================================================

  const links =
    await extractAllLinks(page, {
      baseUrl:
        "https://bytebytego.com",

      autoClick: true,

      clickLimit: 20,

      waitAfterClickMs: 100,
    });

  console.log(
    "\n================================================="
  );

  console.log("extractAllLinks RESULT");

  console.log(
    "=================================================\n"
  );

  console.dir(links, {
    depth: null,
  });

  // =======================================================
  // CLEANUP
  // =======================================================

  await browser.close();
})();
