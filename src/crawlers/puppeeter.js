const Apify = require("apify");
const dns = require("dns").promises;
const {
  normalizeOutput,
  calculateResponseTime,
  isRedirectedToHttps,
} = require("../helpers");

const puppeteerCrawler = async (requestList) => {
  let request_ipv4,
    request_ipv6 = null;
  let dnsExists = false;

  let blocked = {};

  const crawler = new Apify.PuppeteerCrawler({
    requestList,
    launchPuppeteerOptions: { headless: true },
    handlePageTimeoutSecs: 200,
    gotoFunction: async ({ request, page, puppeteerPool }) => {
      await page.setDefaultNavigationTimeout(0);

      try {
        const { family, address } = await dns.lookup(request.url);

        switch (family) {
          case 4:
            request_ipv4 = address;
            dnsExists = true;
            break;
          case 6:
            request_ipv6 = address;
            dnsExists = true;
            break;
          default:
            dnsExists = false;
            break;
        }
      } catch (e) {
        request.retryCount = 3;
        throw `DNS not found for url: ${request.url}`;
      }

      if (dnsExists) {
        const response = page.goto(request.url);
        return response;
      } else return null;
    },
    handlePageFunction: async ({ page, request, response }) => {
      if (!blocked[request.url]) {
        blocked[request.url] = [];
      }

      await page.setDefaultNavigationTimeout(0);
      try {
        if (!dnsExists) {
          throw new Error("Domain not found");
        }

        const redirectUrls = [];
        const redirectUrlsChain = response.request().redirectChain();
        redirectUrlsChain.forEach((obj) => {
          if (obj.url() !== request.url && obj.url() !== request.url + "/")
            redirectUrls.push(obj.url());
        });

        const statusMessage = response.statusText();
        const timings = JSON.parse(
          await page.evaluate(() => JSON.stringify(window.performance))
        ).timing;

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

        if (statusCode > 400) {
          blocked[request.url].push({
            time: new Date().getTime(),
            response_code: statusCode,
          });
        }

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

          if (httpsStatusCode > 400) {
            blocked[request.url].push({
              time: new Date().getTime(),
              response_code: httpsStatusCode,
            });
          }
        }

        await Apify.pushData(
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
            blocked: blocked[request.url],
          })
        );
      } catch (e) {
        await Apify.pushData(
          normalizeOutput({
            crawlStatus: "error",
            crawlStatusMessage: e,
            request_hostname: request.url,
            blocked: blocked[request.url],
          })
        );
      }
    },
  });

  await crawler.run();
};

module.exports = { puppeteerCrawler };
