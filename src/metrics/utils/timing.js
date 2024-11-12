// Function to calculate duration in milliseconds
const getDurationInMs = (start) => {
  const NS_PER_SEC = 1e9; // Convert nanoseconds to seconds
  const NS_TO_MS = 1e6; // Convert nanoseconds to milliseconds
  const diff = process.hrtime(start);
  return ((diff[0] * NS_PER_SEC + diff[1]) / NS_TO_MS).toFixed(2);
};

module.exports = { getDurationInMs };