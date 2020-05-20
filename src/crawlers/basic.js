const Apify = require("apify");
const dns = require("dns").promises;
const {
  normalizeOutput,
  calculateResponseTime,
  isRedirectedToHttps,
  normalizeHostname,
} = require("../helpers");

const basicCrawler = async (requestList, RETRY_COUNT) => {
  let blocked = {};

  const basicCrawler = new Apify.BasicCrawler({
    requestList,
    maxRequestRetries: RETRY_COUNT,
    handleRequestFunction: async ({ request }) => {
      if (!blocked[request.url]) {
        blocked[request.url] = [];
      }

      try {
        let request_ipv4,
          request_ipv6 = null;

        // jump to catch error if domain not found before crawling
        const { family, address } = await dns.lookup(
          normalizeHostname(request.url)
        );

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

        const {
          body,
          request: req,
          statusCode,
          timings,
          statusMessage,
          redirectUrls,
          headers,
        } = await Apify.utils.requestAsBrowser({
          url: request.url,
        });

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

        // check if website was redirected to https protocol
        let httpsSupport = false;
        let redirectedToHttps = false;
        if (redirectUrls.length > 0)
          redirectedToHttps = isRedirectedToHttps(request.url, redirectUrls[0]);

        if (!redirectedToHttps) {
          const {
            statusCode: httpsStatusCode,
          } = await Apify.utils.requestAsBrowser({
            url: request.url.replace("http", "https"),
          });

          if (httpsStatusCode === 200) {
            httpsSupport = true;
          }
        }

        if (httpsStatusCode > 400) {
          blocked[request.url].push({
            time: new Date().getTime(),
            response_code: httpsStatusCode,
          });
        }

        if (statusCode > 400) {
          blocked[request.url].push({
            time: new Date().getTime(),
            response_code: statusCode,
          });
        }

        await Apify.pushData(
          normalizeOutput({
            body,
            crawlStatus: "ok",
            crawlStatusMessage: errorMessage,
            request_hostname: req.gotOptions.hostname,
            request_ipv4,
            request_ipv6,
            response_code: statusCode,
            response_time: calculateResponseTime(
              timings.start,
              timings.response
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
        const { name: errorMessage, code } = e;
        await Apify.pushData(
          normalizeOutput({
            crawlStatus: "error",
            crawlStatusMessage: `${errorMessage} ${code ? `(${code})` : ""}`,
            request_hostname: request.url,
            blocked: blocked[request.url],
          })
        );
      }
    },
  });

  await basicCrawler.run();
};

module.exports = { basicCrawler };
