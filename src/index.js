require("dotenv").config();
const cookieParser = require("cookie-parser");
const express = require("express");

const { initStripe, queryStripeOrder, stripeCallback, StripeStatusCheck } = require("./paymentService");

const app = express();
const port = 5000;

app.use(express.json());
app.use(express.urlencoded());
app.use(cookieParser());

app.use(async function (req, res, next) {
  const login_secret = req?.cookies?.token; // or req.body.login_secret if it's in the request body
  if (!login_secret) {
    return res.status(401).send({
      code: 401,
      message: "No login Token Provided",
    });
  }
  next();
});

cron.schedule("*/5 * * * *", StripeStatusCheck);
//create stripe order
app.post("/api/topup", multipart(), initStripe);

// query stripe order
app.get("/api/topup/:tx_id", queryStripeOrder);

// callback url for stripe
app.post("/api/stripe/callback", multipart(), stripeCallback);

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
