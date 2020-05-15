const Apify = require("apify");
const dns = require("dns").promises;
const {
  normalizeOutput,
  calculateResponseTime,
  isRedirectedToHttps,
} = require("../helpers");

const basicCrawler = async (requestList, RETRY_COUNT) => {
  const results = [];

  const basicCrawler = new Apify.BasicCrawler({
    requestList,
    maxRequestRetries: RETRY_COUNT,
    handleRequestFunction: async ({ request }) => {
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

        results.push(
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
          })
        );
      } catch (e) {
        console.log(e);
        return;
        const { name: errorMessage, hostname, code } = e;
        results.push(
          normalizeOutput({
            crawlStatus: "error",
            crawlStatusMessage: `${errorMessage} ${code ? `(${code})` : ""}`,
            request_hostname: hostname,
          })
        );
      }
    },
  });

  await basicCrawler.run();

  return results;
};

module.exports = { basicCrawler };
