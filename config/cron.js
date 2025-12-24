const battleCronJob = require("../jobs/battleCron.job");

const initCronJobs = () => {
    battleCronJob();
    console.log("✅ Cron jobs initialized");
};

module.exports = initCronJobs