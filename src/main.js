const Apify = require("apify");
const request = require("request-promise");
const { csvToArray } = require("./helpers");
const { basicCrawler } = require("./crawlers/basic");
const { puppeteerCrawler } = require("./crawlers/puppeeter");

let results;

Apify.main(async () => {
  const input = await Apify.getInput();

  console.log(input);
  return;

  const DOMAINS_URL = input.sources.requestFromUrl;
  const DOMAINS_COUNT = parseInt(input.domainsCount);
  const RETRY_COUNT = 3;
  const CRAWLER_TYPE = input.crawlerType;

  const csv = await request(DOMAINS_URL);

  const urls = csvToArray(csv, DOMAINS_COUNT);
  const requestList = await Apify.openRequestList("my-request-list", urls);

  if (CRAWLER_TYPE === "basic") {
    results = await basicCrawler(requestList, RETRY_COUNT);
  } else {
    results = await puppeteerCrawler(requestList);
  }

  // return array of JSON objects
  await Apify.pushData(results);
});
