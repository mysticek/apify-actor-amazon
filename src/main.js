const Apify = require("apify");
const dns = require("dns").promises;
const request = require("request-promise");
const {
  csvToArray,
  normalizeOutput,
  calculateResponseTime,
} = require("./helpers");

Apify.main(async () => {
  const DOMAINS_COUNT = 30;

  const input = await Apify.getInput();

  const csv = await request(
    "https://apify-uploads-prod.s3.amazonaws.com/WoHcDsskx6ERGKznw-XkfjWEqPMiZxDkrZo-2020-04-27_dot_blog_zone_dums_180306_%282%29.csv"
  );

  const urls = csvToArray(csv, DOMAINS_COUNT);
  const requestList = await Apify.openRequestList("my-request-list", urls);

  const results = [];

  // Create a basic crawler that will use request-promise to download
  // web pages from a given list of URLs
  const basicCrawler = new Apify.BasicCrawler({
    requestList,
    maxRequestRetries: 1,
    handleRequestFunction: async ({ request }) => {
      const {
        body,
        request: req,
        statusCode,
        timings,
      } = await Apify.utils.requestAsBrowser({
        url: request.url,
      });

      let request_ipv4,
        request_ipv6 = null;

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

      results.push(
        normalizeOutput({
          body,
          crawlStatus: "ok",
          crawlStatusMessage: null,
          request_hostname: req.gotOptions.hostname,
          request_ipv4,
          request_ipv6,
          response_code: statusCode,
          response_time: calculateResponseTime(timings.start, timings.response),
        })
      );
    },

    handleFailedRequestFunction: async ({ request, error }) => {
      const { name: errorName, gotOptions, statusCode } = error;

      console.log("request ---- ");
      console.log(request);
      return;

      console.log("Crawl error...");

      let request_ipv4, request_ipv6;

      return;

      results.push({
        body: null,
        crawlStatus: "error",
        crawlStatusMessage: errorName,
        request_hostname: gotOptions.hostname,
        request_ipv4,
        request_ipv6,
        response_code: statusCode,
        response_time: null,
      });
    },
  });

  await basicCrawler.run();

  // return array of JSON objects
  await Apify.pushData(results);
});
