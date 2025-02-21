var _payment_PaymentService = require("./payment_PaymentService_model");

function initModels(sequelize) {
  var payment_PaymentService = _payment_PaymentService(sequelize, DataTypes);

  return {
    payment_PaymentService,
  };
}
module.exports.initModels = initModels;
module.exports.default = initModels;
