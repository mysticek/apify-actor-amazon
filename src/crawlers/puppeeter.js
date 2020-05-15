const Apify = require("apify");
const dns = require("dns").promises;
const {
  normalizeOutput,
  calculateResponseTime,
  isRedirectedToHttps,
} = require("../helpers");

const puppeteerCrawler = async (requestList) => {
  const results = [];

  const crawler = new Apify.PuppeteerCrawler({
    requestList,
    launchPuppeteerOptions: { headless: true },
    handlePageFunction: async ({ page, request, response }) => {
      await page.setDefaultNavigationTimeout(0);
      const redirectUrlsChain = response.request().redirectChain();
      const redirectUrls = redirectUrlsChain.map((obj) => obj.url);
      const statusMessage = response.statusText();
      const timings = JSON.parse(
        await page.evaluate(() => JSON.stringify(window.performance))
      ).timing;

      try {
        let request_ipv4,
          request_ipv6 = null;

        // jump to catch error if domain not found before crawling
        const { family, address } = await dns.lookup(request.url);

        switch (family) {
          case 4:
            request_ipv4 = address;
            break;
          case 6:
            request_ipv6 = address;
            break;
          default:
            break;
        }

        // fill redirect array with redirect urls
        const redirect = [];
        let redirectCount = redirectUrls.length;
        let redirectUrlsArray = redirectUrls.slice();
        while (redirectCount > 0) {
          const redirectArrayLength = redirect.length;

          if (redirectArrayLength > 0) {
            redirect.push({
              origin: redirect[redirectArrayLength - 1].target,
              target: redirectUrlsArray.shift(),
            });
          } else {
            redirect.push({
              origin: request.url,
              target: redirectUrlsArray.shift(),
            });
          }

          redirectCount--;
        }

        // set error mesage if exists
        let errorMessage = null;
        if (statusMessage !== "OK") {
          errorMessage = statusMessage;
        }

        const body = await page.evaluate(() => document.body.innerHTML);

        const headers = response.headers();
        const statusCode = response.status();
        const hostname = response.url();

        // check if website was redirected to https protocol
        let httpsSupport = false;
        let redirectedToHttps = false;
        if (redirectUrls.length > 0)
          redirectedToHttps = isRedirectedToHttps(request.url, redirectUrls[0]);

        if (!redirectedToHttps) {
          const httpsResponse = await page.goto(
            request.url.replace("http", "https")
          );

          const httpsStatusCode = httpsResponse.status();

          if (httpsStatusCode === 200) {
            httpsSupport = true;
          }
        }

        results.push(
          normalizeOutput({
            body,
            crawlStatus: "ok",
            crawlStatusMessage: errorMessage,
            request_hostname: hostname,
            request_ipv4,
            request_ipv6,
            response_code: statusCode,
            response_time: calculateResponseTime(
              timings.requestStart,
              timings.responseEnd
            ),
            port_80: true,
            port_443: redirectedToHttps || httpsSupport,
            https_redirect: redirectedToHttps,
            redirect,
            header: headers,
          })
        );
      } catch (e) {
        const { hostname, code, syscall: errorMessage } = e;
        results.push(
          normalizeOutput({
            crawlStatus: "error",
            crawlStatusMessage: `${errorMessage} ${code ? `(${code})` : ""}`,
            request_hostname: request.url,
          })
        );
      }
    },
  });

  await crawler.run();

  return results;
};

module.exports = { puppeteerCrawler };
