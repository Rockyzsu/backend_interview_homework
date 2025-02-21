const ErrorLogSQL = {
    insert: `INSERT INTO payment_error_log (
        user_id,
        change_date,
        change_type,
        data,
        audit_id
      ) VALUES (?,NOW(),?,?, ?);
      `,
    init: `CREATE TABLE IF NOT EXISTS payment_error_log (
      log_id int AUTO_INCREMENT PRIMARY KEY,
      user_id int NOT NULL,
      change_date datetime(0) NOT NULL,
      change_type text NOT NULL,
      audit_id int NOT NULL,
      data LONGTEXT
    );`
};

module.exports = ErrorLogSQL;