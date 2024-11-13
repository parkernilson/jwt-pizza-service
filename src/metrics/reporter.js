const config = require("../config.js");
const { getCpuUsagePercentage, getMemoryUsagePercentage } = require("./utils/system-usage.js");

class MetricsReporter {
  reportSystemUsage() {
    const cpuUsage = getCpuUsagePercentage();
    const memoryUsage = getMemoryUsagePercentage();
    this.sendMetricToGrafana("system", { metric: "cpu" }, { usage: cpuUsage });
    this.sendMetricToGrafana(
      "system",
      { metric: "memory" },
      { usage: memoryUsage }
    );
  }

  reportHTTPRequests(postRequests, getRequests, deleteRequests, putRequests) {
    this.sendMetricToGrafana(
      "request",
      { method: "post" },
      { total: postRequests }
    );
    this.sendMetricToGrafana(
      "request",
      { method: "get" },
      { total: getRequests }
    );
    this.sendMetricToGrafana(
      "request",
      { method: "delete" },
      { total: deleteRequests }
    );
    this.sendMetricToGrafana(
      "request",
      { method: "put" },
      { total: putRequests }
    );
  }

  reportAuthenticationRequests(successes, failures) {
    this.sendMetricToGrafana(
      "auth",
      { success: true },
      { total: successes }
    );
    this.sendMetricToGrafana(
      "auth",
      { success: false },
      { total: failures }
    );
  }

  reportPizzaStatistics(pizzasSold, revenue, creationFailures) {
    this.sendMetricToGrafana(
      "pizza",
      { metric: "sold" },
      { total: pizzasSold }
    );
    this.sendMetricToGrafana(
      "pizza",
      { metric: "revenue" },
      { total: revenue }
    );
    this.sendMetricToGrafana(
      "pizza",
      { metric: "creation", success: false },
      { total: creationFailures }
    );
  }

  reportEndpointLatency(path, method, latency) {
    this.sendMetricToGrafana(
      "endpoint",
      { path, method },
      { latency }
    );
  }

  reportPizzaCreationLatency(latency) {
    this.sendMetricToGrafana(
      "pizza",
      { metric: "creation", success: true },
      { latency }
    );
  }

  reportActiveUsers(activeUsers) {
    this.sendMetricToGrafana(
      "users",
      { active: true },
      { total: activeUsers }
    );
  }

  /**
   *
   * @param {string} metricPrefix
   * @param {{[tagName: string]: string}} tags
   * @param {{[metricName: string | number]}} metrics
   */
  sendMetricToGrafana(metricPrefix, tags, metrics) {
    if (process.env.NODE_ENV === "test") {
      return;
    }

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
        if (config.metrics.verboseLogging) {
          if (!response.ok) {
            console.error("Failed to push metrics data to Grafana");
          } else {
            console.log(`Pushed ${metric}`);
          }
        }
      })
      .catch((error) => {
        console.error("Error pushing metrics:", error);
      });
  }
}

module.exports = { MetricsReporter };
