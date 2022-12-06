import { createRequire } from "module";
import Logger from "@reactioncommerce/logger";
import config from "../config.js";


const require = createRequire(import.meta.url);

const pkg = require("../../package.json");

const { name, version } = pkg;
const logCtx = {
  name,
  version,
  file: "api/addJob.js"
};

const {
  JOBS_SERVER_REMOVE_ON_COMPLETE,
  JOBS_SERVER_DEFAULT_ATTEMPTS,
  JOBS_SERVER_REMOVE_ON_FAIL,
  JOBS_SERVER_BACKOFF_MS,
  JOBS_SERVER_BACKOFF_STRATEGY
} = config;

const defaultConfig = {
  attempts: JOBS_SERVER_DEFAULT_ATTEMPTS,
  removeOnComplete: JOBS_SERVER_REMOVE_ON_COMPLETE,
  removeOnFail: JOBS_SERVER_REMOVE_ON_FAIL,
  backoff: {
    type: JOBS_SERVER_BACKOFF_STRATEGY,
    delay: JOBS_SERVER_BACKOFF_MS
  }
};

/**
 * @summary add a job to a named queue
 * @param {Object} context - The application context
 * @param {String} queueName - The queue to add the job to
 * @param {Object} jobData - Data the job uses to process
 * @param {Object} options - options for the add job function
 * @return {Promise<Object>|{Boolean}} - The job instance or false
 */
export default function addJob(context, queueName, jobData, options = defaultConfig) {
  Logger.info({ queueName, ...logCtx }, "Added job to queue");
  if (context.bullQueue.jobQueues[queueName]) {
    Logger.info({ queueName, ...logCtx }, "Adding job");
    return context.bullQueue.jobQueues[queueName].add(jobData, options);
  }
  Logger.error(logCtx, "Cannot add job to queue as it does not exist. You must call createQueue first");
  return false;
}
