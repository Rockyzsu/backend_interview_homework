const errorsql = require("./errorlogsql");
const pool = require("./dbconfig");

function executeQuery(query, params) {
    return new Promise((resolve, reject) => {
      pool.getConnection((err, connection) => {
        if (err) {
          reject(err);
          return;
        }
        connection.query(query, params, (error, results) => {
          connection.release();
          if (error) {
            reject(error);
            return;
          }
          resolve(results);
        });
      });
    });
  }

const logError = async (user_id, error_type, error_data, auditId) => {
    try {
      await executeQuery(errorsql.insert, [
        user_id,
        error_type,
        error_data,
        auditId,
      ]);
    } catch (error) {
      console.error("Failed to log error:", error);
    }
  };

module.exports={logError,executeQuery}