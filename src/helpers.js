// parse csv to array
const csvToArray = (csv, count = false) => {
  const editedCsv = csv.replace(/["'\r]/g, "");
  let result = editedCsv.split("\n");

  // remove empty strings from csv
  result = result.filter((res) => res !== "");

  // format url to force http:// protocol
  result = result.map((str) =>
    startAsWebsite(str) ? str : `http://www.${str}`
  );

  if (count) {
    result = result.slice(10, count);
  }

  return result;
};

// test if domain name from csv is in correct format
const startAsWebsite = (str) => {
  const re = new RegExp("^www?.", "i");
  return re.test(str);
};

const calculateResponseTime = (start, response) => {
  const diff = response - start;
  return parseFloat((diff / 1000) % 60);
};

const normalizeOutput = ({
  body = null,
  crawlStatus,
  crawlStatusMessage,
  request_hostname,
  request_ipv4,
  request_ipv6,
  response_code,
  response_time,
}) => {
  return {
    time: new Date().getTime(),
    doc: body,
    status: crawlStatus,
    status_message: crawlStatusMessage,
    request_hostname,
    request_ipv4,
    request_ipv6,
    response_code,
    response_time,
  };
};

module.exports = { csvToArray, normalizeOutput, calculateResponseTime };
