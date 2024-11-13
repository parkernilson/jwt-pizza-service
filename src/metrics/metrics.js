const { MetricsReporter } = require("./reporter");
const { getDurationInMs } = require("./utils/timing");

class Metrics {
  constructor() {
    this.reporter = new MetricsReporter();

    this.postRequests = 0;
    this.deleteRequests = 0;
    this.getRequests = 0;
    this.putRequests = 0;
    this.activeUsers = {};
    this.authenticationSuccesses = 0;
    this.authenticationFailures = 0;
    this.creationFailures = 0;
    this.pizzasSold = 0;
    this.revenue = 0;

    if (process.env.NODE_ENV !== 'test') {
      this.startReporting();
    }
  }

  startReporting() {
    const timer = setInterval(() => {
      this.reporter.reportSystemUsage();

      // Report on HTTP Requests
      this.reporter.reportHTTPRequests(
        this.postRequests,
        this.getRequests,
        this.deleteRequests,
        this.putRequests
      )

      // Report on Authentication Requests
      this.reporter.reportAuthenticationRequests(
        this.authenticationSuccesses,
        this.authenticationFailures
      )

      // Report on Pizza Statistics
      this.reporter.reportPizzaStatistics(
        this.pizzasSold,
        this.revenue,
        this.creationFailures
      )

      // Report active users
      this.reporter.reportActiveUsers(Object.keys(this.activeUsers).length);
      this.clearInactiveUsers();
    }, 10000);
    timer.unref();
  }

  clearInactiveUsers() {
    const now = Date.now();
    Object.keys(this.activeUsers).forEach((key) => {
      if (now - this.activeUsers[key] > 30000) {
        delete this.activeUsers[key];
      }
    });
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

  addRevenue(revenue) {
    this.revenue += revenue;
  }

  incrementPizzasSold(pizzasSold) {
    this.pizzasSold += pizzasSold;
  }

  incrementCreationFailures() {
    this.creationFailures++;
  }

  incrementRequestCount(method) {
    switch (method) {
      case 'POST':
        this.incrementPostRequests();
        break;
      case 'DELETE':
        this.incrementDeleteRequests();
        break;
      case 'GET':
        this.incrementGetRequests();
        break;
      case 'PUT':
        this.incrementPutRequests();
        break;
    }
  }

  incrementSuccessfulAuthentications() {
    this.authenticationSuccesses++;
  }

  incrementFailedAuthentications() {
    this.authenticationFailures++;
  }

  get requestMetricsTracker() {
    return (req, res, next) => {
      const start = process.hrtime();

      const originalEnd = res.end;
      res.end = (...args) => {
        const duration = getDurationInMs(start);
        const path = req.baseUrl + (req.route ? req.route.path : req.path);

        this.incrementRequestCount(req.method);

        this.reporter.reportEndpointLatency(path, req.method, duration);

        originalEnd.apply(res, args);
      };
      next();
    };
  }

  get activeUserTracker() {
    /** @type {(req: import('express').Request, res: import('express').Response, next: import('express').NextFunction)} */
    return (req, res, next) => {
      if (req.user) {
        this.activeUsers[req.user.id] = Date.now();
      }
      next();
    };
  }

  reportPizzaCreationLatency(latency) {
    this.reporter.reportPizzaCreationLatency(latency);
  }

}

const metrics = new Metrics();
module.exports = metrics;
