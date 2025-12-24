const express = require('express')
const cors = require('cors')
const path = require("path")
const connectDb = require('./database/ConnectDb')
const PORT = 3000
const routes = require('./routes/route')
const superAdminRoutes = require('./routes/superAdmin')
const orderRoutes = require('./routes/order')
const initCronJobs = require('./config/cron')
require('dotenv').config()


const app = express()
//using cors
app.use(cors())
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use("/", express.static(path.resolve(__dirname, "./uploads/user")));
app.use("/", express.static(path.resolve(__dirname, "./uploads/admin")));
app.use("/", express.static(path.resolve(__dirname, "./uploads/post")));
app.use("/", express.static(path.resolve(__dirname, "./uploads/service")));
app.use("/", express.static(path.resolve(__dirname, "./uploads/technician")));
app.use("/", express.static(path.resolve(__dirname, "./uploads/battle")));
app.use("/", express.static(path.resolve(__dirname, "./uploads/product/")));
app.use("/", express.static(path.resolve(__dirname, "./uploads/assets")));

app.use('/api', routes)
app.use('/api/superAdmin', superAdminRoutes)
app.use('/api/order', orderRoutes)

// app.use('/templates', express.static(path.join(__dirname, './template')));

app.get('/', (req, res) => {
  res.send({
    api: "working",
    succcess: true
  })
})

const start = () => {
  try {
    connectDb();
    initCronJobs();
    app.listen(PORT, () => {
      console.log(`Server is Running on PORT: ${PORT}`);
    })
  } catch (error) {
    console.log(`Having Errors Running On Port : ${PORT}`)
  }
};

start();
