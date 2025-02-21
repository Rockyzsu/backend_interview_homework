const sequelize = require("./db");
var initModels = require("./init-models");
const models = initModels(sequelize);
const Stripe = require("stripe");

const getExpiredTime = "SELECT value from payment_parameters where code = 'expiredMinutes'";
const selectPaymentServiceByOrderId = "SELECT orderId from payment_PaymentService where orderId =?";

const initStripe = async (req, res, next) => {
  let {
    orderId,
    orderAmount,
    orderDetail,
    UID,
    memberName,
    memberEmail,
    memberPhone,
    paymentCallbackByServiceURL,
    isInstallment,
    mixPaymentId,
    currency,
    merchantBranchId,
    countryId,
  } = req.body;
  let expiredMinutesCall = executeQuery(getExpiredTime);
  let isRepayCall = executeQuery(selectPaymentServiceByOrderId, [orderId, mixPaymentId ?? 0]);
  let [expiredMinutes, isRepayCallRes] = await Promise.all([expiredMinutesCall, isRepayCall]);
  let isRepay = isRepayCallRes?.length > 0;
  let insertPaymentServiceRes;
  if (!isRepay) {
    // create new order
    insertPaymentServiceRes = await models.payment_PaymentService.create({
      orderId,
      paymentType: 7,
      status: "init",
      orderAmount, // no need conversion
      orderDetail,
      UID,
      memberName,
      memberEmail,
      memberphone: memberPhone,
      paymentCallbackByServiceURL,
      mixPaymentId: mixPaymentId ?? 0,
      expiredDtm: sequelize.literal(`DATE_ADD(NOW(), INTERVAL ${expiredMinutes?.[0]?.value} MINUTE)`),
      currency,
      merchantBranchId,
      countryId,
    });
  } else {
    insertPaymentServiceRes = await models.payment_PaymentService.findOne({
      where: {
        orderId,
      },
    });
  }

  // query key
  const paymentConfig = await models.payment_cust_paymentMethod_config.findOne({
    where: {
      paymentType: 7, // stripe
      [Op.or]: [{ merchantBranchId }, { merchantBranchId: 0 }],
      [Op.or]: [{ countryId }, { countryId: 0 }],
    },
    order: [
      ["merchantBranchId", "DESC"], // Prefer records with variableMerchantBranchId if both exist
    ],
  });

  let paymentIntent;
  try {
    // api doc = https://docs.stripe.com/api/payment_intents/create
    const stripe = new Stripe(paymentConfig.merchantSecret);

    const paymentIntentParam = {
      amount: orderAmount,
      currency: currency,
      automatic_payment_methods: {
        enabled: true,
      },
      // confirm: true, // Set to true to attempt to confirm this PaymentIntent immediately. This parameter defaults to false. When creating and confirming a PaymentIntent at the same time, you can also provide the parameters available in the Confirm API.
      // customer: '', // D of the Customer this PaymentIntent belongs to, if one exists. Payment methods attached to other Customers cannot be used with this PaymentIntent. If setup_future_usage is set and this PaymentIntent’s payment method is not card_present, then the payment method attaches to the Customer after the PaymentIntent has been confirmed and any required actions from the user are complete. If the payment method is card_present and isn’t a digital wallet, then a generated_card payment method representing the card is created and attached to the Customer instead.
      description: orderDetail, // An arbitrary string attached to the object. Often useful for displaying to users.
      // metadata: {}, // Set of key-value pairs that you can attach to an object. This can be useful for storing additional information about the object in a structured format. Individual keys can be unset by posting an empty value to them. All keys can be unset by posting an empty value to metadata.
      // off_session: "", // boolean | string, only when confirm=true. Set to true to indicate that the customer isn’t in your checkout flow during this payment attempt and can’t authenticate. Use this parameter in scenarios where you collect card details and charge them later. This parameter can only be used with confirm=true.
      // payment_method: "", // ID of the payment method (a PaymentMethod, Card, or compatible Source object) to attach to this PaymentIntent. If you omit this parameter with confirm=true, customer.default_source attaches as this PaymentIntent’s payment instrument to improve migration for users of the Charges API. We recommend that you explicitly provide the payment_method moving forward.
      // receipt_email: "test@gmail.com", // Email address to send the receipt to. If you specify receipt_email for a payment in live mode, you send a receipt regardless of your email settings.
      // setup_future_usage: "", // Indicates that you intend to make future payments with this PaymentIntent’s payment method. If you provide a Customer with the PaymentIntent, you can use this parameter to attach the payment method to the Customer after the PaymentIntent is confirmed and the customer completes any required actions. If you don’t provide a Customer, you can still attach the payment method to a Customer after the transaction completes. If the payment method is card_present and isn’t a digital wallet, Stripe creates and attaches a generated_card payment method representing the card to the Customer instead. When processing card payments, Stripe uses setup_future_usage to help you comply with regional legislation and network rules, such as SCA.
      // setup_future_usage desc // off_session = Use off_session if your customer may or may not be present in your checkout flow.
      // setup_future_usage desc // on_session = Use on_session if you intend to only reuse the payment method when your customer is present in your checkout flow.
      // shipping: {
      //   address: {
      //     city: "",
      //     country: "MY",
      //     line1: "",
      //     line2: "",
      //     postal_code: "",
      //     state: "",
      //   },
      //   name: "", // Required, Recipient name.
      //   carrier: "", // The delivery service that shipped a physical product, such as Fedex, UPS, USPS, etc.
      //   phone: "", // Recipient phone (including extension).
      //   tracking_number: "", // The tracking number for a physical product, obtained from the delivery service. If multiple tracking numbers were generated for this purchase, please separate them with commas.
      // },
      // statement_descriptor: "", // Text that appears on the customer’s statement as the statement descriptor for a non-card charge. This value overrides the account’s default statement descriptor. For information about requirements, including the 22-character limit, see the Statement Descriptor docs. Setting this value for a card charge returns an error. For card charges, set the statement_descriptor_suffix instead.
      // statement_descriptor_suffix: "", // Provides information about a card charge. Concatenated to the account’s statement descriptor prefix to form the complete statement descriptor that appears on the customer’s statement.
      // application_fee_amount: 0, // The amount of the application fee (if any) that will be requested to be applied to the payment and transferred to the application owner’s Stripe account. The amount of the application fee collected will be capped at the total payment amount. For more information, see the PaymentIntents use case for connected accounts.
      // capture_method: "", // Controls when the funds will be captured from the customer’s account.
      // capture_method desc // automatic = Stripe automatically captures funds when the customer authorizes the payment.
      // capture_method desc // automatic_async = (Default) Stripe asynchronously captures funds when the customer authorizes the payment. Recommended over capture_method=automatic due to improved latency. Read the integration guide for more information.
      // capture_method desc // manual = Place a hold on the funds when the customer authorizes the payment, but don’t capture the funds until later. (Not all payment methods support this.)
      // confirmation_method: "", // Describes whether we can confirm this PaymentIntent automatically, or if it requires customer action to confirm the payment.
      // confirmation_method desc // automatic = (Default) PaymentIntent can be confirmed using a publishable key. After next_actions are handled, no additional confirmation is required to complete the payment.
      // confirmation_method desc // manual = All payment attempts must be made using a secret key. The PaymentIntent returns to the requires_confirmation state after handling next_actions, and requires your server to initiate each payment attempt with an explicit confirmation.
      // confirmation_token: "", // only when confirm=true, ID of the ConfirmationToken used to confirm this PaymentIntent. If the provided ConfirmationToken contains properties that are also being provided in this request, such as payment_method, then the values in this request will take precedence.
      // error_on_requires_action: "", // only when confirm=true, Set to true to fail the payment attempt if the PaymentIntent transitions into requires_action. Use this parameter for simpler integrations that don’t handle customer actions, such as saving cards without authentication. This parameter can only be used with confirm=true.
      // mandate: "", // only when confirm=true, ID of the mandate that’s used for this payment. This parameter can only be used with confirm=true.
      // mandate_data: {
      //   customer_acceptance: {
      //     type: "", // The type of customer acceptance information included with the Mandate. One of online or offline.
      //     accepted_at: "", // timestamp, secret key only. The time at which the customer accepted the Mandate.
      //     offline: {}, // object. If this is a Mandate accepted offline, this hash contains details about the offline acceptance.
      //     online: {
      //       ip_address: "", // Required. The IP address from which the Mandate was accepted by the customer.
      //       user_agent: "", // Required. The user agent of the browser from which the Mandate was accepted by the customer.
      //     }, // object. If this is a Mandate accepted online, this hash contains details about the online acceptance.
      //   }, // This hash contains details about the customer acceptance of the Mandate.
      // }, // only when confirm=true, This hash contains details about the Mandate to create. This parameter can only be used with confirm=true.
      // on_behalf_of: "", // Connect only. The Stripe account ID that these funds are intended for. Learn more about the use case for connected accounts.
      // payment_method_configuration: "", // The ID of the payment method configuration to use with this PaymentIntent.
      // payment_method_data: {
      //   type: "", // enum, Required. The type of the PaymentMethod. An additional hash is included on the PaymentMethod with a name matching this value. It contains additional information specific to the PaymentMethod type.
      //   acss_debit: {
      //     account_number: "", // Required. Customer’s bank account number.
      //     institution_number: "", // Required. Institution number of the customer’s bank.
      //     transit_number: "", // Required. Transit number of the customer’s bank.
      //   }, // If this is an acss_debit PaymentMethod, this hash contains details about the ACSS Debit payment method.
      //   affirm: {}, // object. If this is an affirm PaymentMethod, this hash contains details about the Affirm payment method.
      //   afterpay_clearpay: {}, // object.If this is an AfterpayClearpay PaymentMethod, this hash contains details about the AfterpayClearpay payment method.
      //   alipay: {}, // object.If this is an Alipay PaymentMethod, this hash contains details about the Alipay payment method.
      //   allow_redisplay: "", //This field indicates whether this payment method can be shown again to its customer in a checkout flow. Stripe products such as Checkout and Elements use this field to determine whether a payment method can be shown as a saved payment method in a checkout flow. The field defaults to unspecified.
      //   // allow_redisplay desc // always = Use always to indicate that this payment method can always be shown to a customer in a checkout flow.
      //   // allow_redisplay desc // limited = Use limited to indicate that this payment method can’t always be shown to a customer in a checkout flow. For example, it can only be shown in the context of a specific subscription.
      //   // allow_redisplay desc // unspecified = This is the default value for payment methods where allow_redisplay wasn’t set.
      //   alma: {}, // object. If this is a Alma PaymentMethod, this hash contains details about the Alma payment method.
      //   amazon_pay: {}, // object. If this is a AmazonPay PaymentMethod, this hash contains details about the AmazonPay payment method.
      //   au_becs_debit: {
      //     account_number: "", // Required. The account number for the bank account.
      //     bsb_number: "", // Required. Bank-State-Branch number of the bank account.
      //   }, // object. If this is an au_becs_debit PaymentMethod, this hash contains details about the bank account.
      //   bacs_debit: {
      //     account_number: "", // Account number of the bank account that the funds will be debited from.
      //     sort_code: "", // Sort code of the bank account. (e.g., 10-20-30)
      //   }, // object. If this is a bacs_debit PaymentMethod, this hash contains details about the Bacs Direct Debit bank account.
      //   bancontact: {}, // If this is a bancontact PaymentMethod, this hash contains details about the Bancontact payment method.
      //   billing_details: {
      //     address: {
      //       city: "",
      //       country: "",
      //       line1: "",
      //       line2: "",
      //       postal_code,
      //       state: "",
      //     }, // Billing address.
      //     email: "", // Email address.
      //     name: "", // Full name.
      //     phone: "", // Billing phone number (including extension).
      //   }, // Billing information associated with the PaymentMethod that may be used or required by particular types of payment methods.
      //   blik: {}, // If this is a blik PaymentMethod, this hash contains details about the BLIK payment method.
      //   boleto: {
      //     tax_id: "", // Required. The tax ID of the customer (CPF for individual consumers or CNPJ for businesses consumers)
      //   }, // If this is a boleto PaymentMethod, this hash contains details about the Boleto payment method.
      //   cashapp: {}, // If this is a cashapp PaymentMethod, this hash contains details about the Cash App Pay payment method.
      //   customer_balance: {}, // If this is a customer_balance PaymentMethod, this hash contains details about the CustomerBalance payment method.
      //   eps: {
      //     bank: "", // The customer’s bank.
      //   }, // If this is an eps PaymentMethod, this hash contains details about the EPS payment method.
      //   fpx: {
      //     bank: "", // Required. The customer’s bank.
      //   }, // If this is an fpx PaymentMethod, this hash contains details about the FPX payment method.
      //   giropay: {}, // If this is a giropay PaymentMethod, this hash contains details about the Giropay payment method.
      //   grabpay: {}, // If this is a grabpay PaymentMethod, this hash contains details about the GrabPay payment method.
      //   ideal: {
      //     bank: "", // The customer’s bank. Only use this parameter for existing customers. Don’t use it for new customers.
      //   }, // If this is an ideal PaymentMethod, this hash contains details about the iDEAL payment method.
      //   interac_present: {}, // If this is an interac_present PaymentMethod, this hash contains details about the Interac Present payment method.
      //   kakao_pay: {}, // If this is a kakao_pay PaymentMethod, this hash contains details about the Kakao Pay payment method.
      //   klarna: {
      //     dob: {
      //       day: 1, // integer. Required. The day of birth, between 1 and 31.
      //       month: 1, // integer. Required. The month of birth, between 1 and 12.
      //       year: 1234, // integer. Required. The four-digit year of birth.
      //     }, // Customer’s date of birth
      //   }, // If this is a klarna PaymentMethod, this hash contains details about the Klarna payment method.
      //   konbini: {}, // If this is a konbini PaymentMethod, this hash contains details about the Konbini payment method.
      //   kr_card: {}, // If this is a kr_card PaymentMethod, this hash contains details about the Korean Card payment method.
      //   link: {}, // If this is an Link PaymentMethod, this hash contains details about the Link payment method.
      //   metadata: {}, // object. Set of key-value pairs that you can attach to an object. This can be useful for storing additional information about the object in a structured format. Individual keys can be unset by posting an empty value to them. All keys can be unset by posting an empty value to metadata.
      //   mobilepay: {}, // If this is a mobilepay PaymentMethod, this hash contains details about the MobilePay payment method.
      //   multibanco: {}, // If this is a multibanco PaymentMethod, this hash contains details about the Multibanco payment method.
      //   naver_pay: {
      //     funding: "", // enum. Whether to use Naver Pay points or a card to fund this transaction. If not provided, this defaults to card.
      //     // funding desc // card = Use a card to fund this transaction.
      //     // funding desc // points = Use Naver Pay points to fund this transaction.
      //   }, // If this is a naver_pay PaymentMethod, this hash contains details about the Naver Pay payment method.
      //   oxxo: {}, // If this is an oxxo PaymentMethod, this hash contains details about the OXXO payment method.
      //   p24: {
      //     bank:'',// enum. The customer’s bank.
      //   },// If this is a p24 PaymentMethod, this hash contains details about the P24 payment method.

      // }, // If provided, this hash will be used to create a PaymentMethod. The new PaymentMethod will appear in the payment_method property on the PaymentIntent.
      // return_url: "", // The URL to redirect your customer back to after they authenticate or cancel their payment on the payment method’s app or site. If you’d prefer to redirect to a mobile application, you can alternatively supply an application URI scheme. This parameter can only be used with confirm=true.
      use_stripe_sdk: true, // Set to true when confirming server-side and using Stripe.js, iOS, or Android client-side SDKs to handle the next actions.
    };

    paymentIntent = await stripe.paymentIntents.create(paymentIntentParam);
  } catch (error) {
    logError("", "initStripe", JSON.stringify(error), orderId); // id for audit log check for payment data
  }

  // store in paymentIntent result in db
  await models.payment_PaymentService.update(
    {
      transactionId: paymentIntent.id,
      response_param: JSON.stringify({
        paymentIntent: paymentIntent,
      }),
    },
    {
      where: {
        orderId,
      },
    }
  );

  return {
    paymentConfig,
    paymentData: insertPaymentServiceRes,
    paymentIntent,
  };
};

const stripeCallback = async (params, body, query) => {
  // status = succeeded, processing, requires_payment_method
  const { id } = params; // for isa2u id is parent id, others id is sales order id
  const { payment_intent, payment_intent_client_secret, redirect_status } = query;

  // if other than succeeded, processing, requires_payment_method status
  if (!["succeeded", "processing", "requires_payment_method"].includes(redirect_status)) {
    logError("", "stripeCallback_update_error", JSON.stringify(query), id);
  }

  // success
  if (redirect_status === "succeeded") {
    // retrieve payment data
    const paymentData = await models.payment_PaymentService.findOne({
      where: {
        orderId: +id,
        paymentType: 7, // stripe
      },
    });

    let insertResParam = JSON.parse(paymentData.response_param);
    insertResParam.response = query;

    // proceeed to update response and update status
    const sqlquery = `
        UPDATE payment_PaymentService
        SET status = :status,
            transactionDate = :transactionDate,
            updatedDtm = :updatedDtm,
            response_param = :responseParam
        WHERE orderId = :orderId
      `;

    const replacements = {
      status: "paid",
      transactionDate: moment().unix(),
      // paymentMode: PymtMethod, // paymentMode = :paymentMode,
      updatedDtm: moment().format("YYYY-MM-DD HH:mm:ss"),
      responseParam: JSON.stringify(insertResParam), // Assuming responseParamValue is your parameter value
      orderId: id,
    }; // Bind values to the query

    try {
      const [updatedRowsCount, updatedRows] = await sequelize.query(sqlquery, {
        replacements,
        type: sequelize.QueryTypes.UPDATE,
      });
      if (updatedRows > 0) {
        // pass data to sales api stripe process
        try {
          const updateSalesApi = await axios.post(`${modulePATH("SALES")}api/salesorder/stripe/process/${id}`);
        } catch (error) {
          logError("", "StripeCallback_stripeProcess", JSON.stringify(error?.response?.data), id);
        }
      }
    } catch (error) {
      logError("", "StripeCallback_update", JSON.stringify(error), id);
    }
  }

  return redirection();
};

// cronjob to query unpaid data and sync data with stripe
const StripeStatusCheck = async () => {
  try {
    const paymentData = await models.payment_PaymentService.findAll({
      where: {
        status: "init",
        paymentType: 7, // stripe
        expiredDtm: {
          [Op.gte]: moment(), // ec2 is utc
          // [Op.gte]: moment().add(-8, "hour"), // -8 is because in db is utc, local is +8
        },
        // response_param: {
        //   [Op.eq]: null, // Checks for non-null values
        // }, // no include this because init will have data
      },
    });

    for (let i = 0; i < paymentData.length; i++) {
      const pData = paymentData[i];

      const paymentConfig = await models.payment_cust_paymentMethod_config.findOne({
        where: {
          paymentType: 7, // stripe
          [Op.or]: [{ merchantBranchId: pData.merchantBranchId }, { merchantBranchId: 0 }],
          countryId: pData.countryId,
        },
        order: [
          ["merchantBranchId", "DESC"], // Prefer records with variableMerchantBranchId if both exist
        ],
      });

      const stripe = new Stripe(paymentConfig.merchantSecret);
      const paymentIntent = await stripe.paymentIntents.retrieve(pData.transactionId);

      if (paymentIntent.status === "succeeded") {
        let insertResParam = JSON.parse(pData.response_param);
        insertResParam.cron_response = paymentIntent;

        // proceeed to update response and update status
        const sqlquery = `
            UPDATE payment_PaymentService
            SET status = :status,
                transactionDate = :transactionDate,
                updatedDtm = :updatedDtm,
                response_param = :responseParam
            WHERE orderId = :orderId
          `;
        const replacements = {
          status: "paid",
          transactionDate: moment().unix(),
          // paymentMode: PymtMethod, // paymentMode = :paymentMode,
          updatedDtm: moment().format("YYYY-MM-DD HH:mm:ss"),
          responseParam: JSON.stringify(insertResParam), // Assuming responseParamValue is your parameter value
          orderId: pData.orderId,
        }; // Bind values to the query

        try {
          const [updatedRowsCount, updatedRows] = await sequelize.query(sqlquery, {
            replacements,
            type: sequelize.QueryTypes.UPDATE,
          });
          if (updatedRows > 0) {
            // pass data to sales api stripe process
            try {
              const updateSalesApi = await axios.post(`${modulePATH("SALES")}api/salesorder/stripe/process/${pData.orderId}`);
            } catch (error) {
              logError("", "StripeCallback_stripeProcess", JSON.stringify(error?.response?.data), pData.orderId);
            }
          }
        } catch (error) {
          logError("", "StripeCallback_update", JSON.stringify(error), pData.orderId);
        }
      }
    }
  } catch (error) {
    console.error(error);
    logError("", "CrobJob:StripeStatusCheck", JSON.stringify(error), "");
  }
};

const queryStripeOrder = async (req, res, next) => {
  try {
    const tx_id = req.params.tx_id;
    const rows = await pool.execute("SELECT * FROM transactions WHERE transactionId = ?", [tx_id]);
    if (row.length === 0) {
      res.status(404).json({ error: "Transaction not found" });
    } else {
      res.status(200).json(rows[0]);
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Error fetching transaction status" });
  }
};

module.exports = { initStripe, queryStripeOrder, stripeCallback, StripeStatusCheck };
