const Apify = require("apify");
const request = require("request-promise");
const { csvToArray } = require("./helpers");
const { basicCrawler } = require("./crawlers/basic");
const { puppeteerCrawler } = require("./crawlers/puppeeter");

Apify.main(async () => {
  // PROD ENVS - uncoment before push to production

  // const input = await Apify.getInput();
  // const DOMAINS_URL = input.sources[0].requestsFromUrl;
  // const DOMAINS_COUNT = parseInt(input.domainsCount);
  // const RETRY_COUNT = 3;
  // const CRAWLER_TYPE = input.crawlerType;

  // const csv = await request(DOMAINS_URL);

  // DEV ENVS - comment before push to production
  const DOMAINS_COUNT = 50;
  const RETRY_COUNT = 3;
  const CRAWLER_TYPE = "basic";
  const csv = await request(
    "https://apify-uploads-prod.s3.amazonaws.com/WoHcDsskx6ERGKznw-XkfjWEqPMiZxDkrZo-2020-04-27_dot_blog_zone_dums_180306_%282%29.csv"
  );

  const urls = csvToArray(csv, DOMAINS_COUNT);
  const requestList = await Apify.openRequestList("my-request-list", urls);

  if (CRAWLER_TYPE === "basic") {
    await basicCrawler(requestList, RETRY_COUNT);
  } else {
    await puppeteerCrawler(requestList);
  }
});
