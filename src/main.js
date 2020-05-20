const Apify = require("apify");
const request = require("request-promise");
const { csvToArray } = require("./helpers");
const { basicCrawler } = require("./crawlers/basic");
const { puppeteerCrawler } = require("./crawlers/puppeeter");

// set ENV to production before build to apify
const ENV = "production";

Apify.main(async () => {
  let DOMAINS_COUNT, DOMAINS_URL, RETRY_COUNT, CRAWLER_TYPE, csv;

  if (ENV === "production") {
    const input = await Apify.getInput();
    DOMAINS_URL = input.sources[0].requestsFromUrl;
    DOMAINS_COUNT = parseInt(input.domainsCount);
    RETRY_COUNT = 3;
    CRAWLER_TYPE = input.crawlerType;
    csv = await request(DOMAINS_URL);
  } else {
    DOMAINS_COUNT = 50;
    RETRY_COUNT = 3;
    CRAWLER_TYPE = "basic";
    csv = await request(
      "https://apify-uploads-prod.s3.amazonaws.com/WoHcDsskx6ERGKznw-XkfjWEqPMiZxDkrZo-2020-04-27_dot_blog_zone_dums_180306_%282%29.csv"
    );
  }

  const urls = csvToArray(csv, DOMAINS_COUNT);
  const requestList = await Apify.openRequestList("my-request-list", urls);

  if (CRAWLER_TYPE === "basic") {
    await basicCrawler(requestList, RETRY_COUNT);
  } else {
    await puppeteerCrawler(requestList);
  }
});
