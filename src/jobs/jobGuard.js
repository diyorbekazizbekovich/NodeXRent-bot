const logger = require("../utils/logger");

/** Cron / interval joblar faqat bir marta start bo'lishi uchun */
const startedJobs = new Set();

function startOnce(jobName, startFn) {
  if (startedJobs.has(jobName)) {
    logger.warn(`Job allaqachon ishga tushgan (skip): ${jobName}`, { context: "Jobs" });
    return false;
  }
  startedJobs.add(jobName);
  startFn();
  logger.info(`Job started: ${jobName}`, { context: "Jobs" });
  return true;
}

function listStartedJobs() {
  return Array.from(startedJobs);
}

module.exports = { startOnce, listStartedJobs };
