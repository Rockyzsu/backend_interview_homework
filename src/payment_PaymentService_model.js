module.exports = function (sequelize, DataTypes) {
  return sequelize.define(
    "payment_PaymentService",
    {
      id: {
        autoIncrement: true,
        type: DataTypes.INTEGER,
        allowNull: false,
        primaryKey: true,
      },
      status: {
        type: DataTypes.STRING(45),
        allowNull: true,
      },
      transactionId: {
        type: DataTypes.STRING(45),
        allowNull: true,
      },
      transactionDate: {
        type: DataTypes.STRING(45),
        allowNull: true,
      },
      orderId: {
        type: DataTypes.STRING(45),
        allowNull: true,
      },
      mixPaymentId: {
        type: DataTypes.INTEGER,
        allowNull: true,
      },
      paymentType: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: {
          model: "payment_PaymentMethodConfig",
          key: "id",
        },
      },
      orderAmount: {
        type: DataTypes.DECIMAL(24, 8),
        allowNull: false,
      },
      orderDetail: {
        type: DataTypes.STRING(45),
        allowNull: true,
      },
      UID: {
        type: DataTypes.STRING(45),
        allowNull: true,
      },
      paymentMode: {
        type: DataTypes.STRING(250),
        allowNull: true,
      },
      memberName: {
        type: DataTypes.STRING(250),
        allowNull: true,
      },
      memberEmail: {
        type: DataTypes.STRING(45),
        allowNull: true,
      },
      memberphone: {
        type: DataTypes.STRING(45),
        allowNull: true,
      },
      paymentCallbackByServiceURL: {
        type: DataTypes.STRING(250),
        allowNull: true,
      },
      expiredDtm: {
        type: DataTypes.DATE,
        allowNull: true,
      },
      clientIP: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      response_param: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      currency: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      countryId: {
        type: DataTypes.INTEGER,
        allowNull: true,
      },
      merchantBranchId: {
        type: DataTypes.INTEGER,
        allowNull: true,
      },
    },
    {
      sequelize,
      tableName: "payment_PaymentService",
      createdAt: "createdDtm",
      updatedAt: "updatedDtm",
      indexes: [
        {
          name: "PRIMARY",
          unique: true,
          using: "BTREE",
          fields: [{ name: "id" }],
        },
        {
          name: "id_UNIQUE",
          unique: true,
          using: "BTREE",
          fields: [{ name: "id" }],
        },
        {
          name: "payment_PaymentService_payment_PaymentMethodConfig_FK",
          using: "BTREE",
          fields: [{ name: "paymentType" }],
        },
      ],
    }
  );
};
