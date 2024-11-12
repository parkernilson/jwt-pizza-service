const config = require("./config.js");
const os = require("os");

function getCpuUsagePercentage() {
  const cpuUsage = os.loadavg()[0] / os.cpus().length;
  return cpuUsage.toFixed(2) * 100;
}

function getMemoryUsagePercentage() {
  const totalMemory = os.totalmem();
  const freeMemory = os.freemem();
  const usedMemory = totalMemory - freeMemory;
  const memoryUsage = (usedMemory / totalMemory) * 100;
  return memoryUsage.toFixed(2);
}

class Metrics {
  constructor() {
    this.postRequests = 0;
    this.deleteRequests = 0;
    this.getRequests = 0;
    this.putRequests = 0;
    this.activeUsers = new Set();
    this.authenticationSuccesses = 0;
    this.authenticationFailures = 0;

    const activeUsersTimer = setInterval(() => {
      // Report on Active Users
      this.sendMetricToGrafana(
        "user",
        { metric: "active" },
        { total: this.activeUsers.size }
      );
      this.activeUsers.clear();
    }, 10000);
    activeUsersTimer.unref();

    const timer = setInterval(() => {
      // Report on CPU Usage
      const cpuUsagePercentage = getCpuUsagePercentage();
      const memoryUsagePercentage = getMemoryUsagePercentage();
      this.sendMetricToGrafana(
        "system",
        { metric: "cpu" },
        { usage: cpuUsagePercentage }
      );
      this.sendMetricToGrafana(
        "system",
        { metric: "memory" },
        { usage: memoryUsagePercentage }
      );

      // Report on HTTP Requests
      this.sendMetricToGrafana(
        "request",
        { method: "post" },
        { total: this.postRequests }
      );
      this.sendMetricToGrafana(
        "request",
        { method: "get" },
        { total: this.getRequests }
      );
      this.sendMetricToGrafana(
        "request",
        { method: "delete" },
        { total: this.deleteRequests }
      );
      this.sendMetricToGrafana(
        "request",
        { method: "put" },
        { total: this.putRequests }
      );

      // Report on Authentication Requests
      this.sendMetricToGrafana(
        "auth",
        { success: true },
        { total: this.authenticationSuccesses }
      );
      this.sendMetricToGrafana(
        "auth",
        { success: false },
        { total: this.authenticationSuccesses }
      );
    }, 10000);
    timer.unref();
  }

  /**
   * @returns {Express}
   */
  get requestTracker() {
    /** @type {(req: import('express').Request, res: import('express').Response, next: import('express').NextFunction)} */
    return (req, res, next) => {
      if (req.method === "POST") {
        this.incrementPostRequests();
      } else if (req.method === "DELETE") {
        this.incrementDeleteRequests();
      } else if (req.method === "GET") {
        this.incrementGetRequests();
      } else if (req.method === "PUT") {
        this.incrementPutRequests();
      }
      next();
    };
  }

  get activeUserTracker() {
    /** @type {(req: import('express').Request, res: import('express').Response, next: import('express').NextFunction)} */
    return (req, res, next) => {
      if (req.user) {
        this.activeUsers.add(req.user.id);
      }
      next();
    };
  }

  incrementSuccessfulAuthentications() {
    this.authenticationSuccesses++;
  }

  incrementFailedAuthentications() {
    this.authenticationFailures++;
  }

  incrementPostRequests() {
    this.postRequests++;
  }

  incrementDeleteRequests() {
    this.deleteRequests++;
  }

  incrementGetRequests() {
    this.getRequests++;
  }

  incrementPutRequests() {
    this.putRequests++;
  }

  /**
   *
   * @param {string} metricPrefix
   * @param {{[tagName: string]: string}} tags
   * @param {{[metricName: string | number]}} metrics
   */
  sendMetricToGrafana(metricPrefix, tags, metrics) {
    tags.source = tags.source || config.metrics.source;

    const metric = `${metricPrefix},${Object.entries(tags)
      .map(([tag, tagVal]) => `${tag}=${tagVal}`)
      .join(",")} ${Object.entries(metrics)
      .map(([metricName, metricValue]) => `${metricName}=${metricValue}`)
      .join(",")}`;

    fetch(`${config.metrics.url}`, {
      method: "post",
      body: metric,
      headers: {
        Authorization: `Bearer ${config.metrics.userId}:${config.metrics.apiKey}`,
      },
    })
      .then((response) => {
        if (!response.ok) {
          console.error("Failed to push metrics data to Grafana");
        } else {
          console.log(`Pushed ${metric}`);
        }
      })
      .catch((error) => {
        console.error("Error pushing metrics:", error);
      });
  }
}

const metrics = new Metrics();
module.exports = metrics;
