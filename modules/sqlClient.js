const mysql = require("mysql2/promise");
const sqlStrings = require("./sqlStrings");
const helper = require("./helper");

const config = {
  host: "192.168.2.2",
  port: 3308,
  user: "root",
  password: "root",
  database: "Huntington",
};

const pool = mysql.createPool(config);

async function registerOOBUser(data) {
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    //Register the user
    await connection.execute(sqlStrings.insertOOBUserQuery, [
      data.username,
      data.disabled,
      data.cred,
    ]);

    //Turn off OOB Mode
    await connection.execute(sqlStrings.turnOffOOBQuery, []);

    //Commit the transaction
    await connection.commit();
  } catch (error) {
    console.error("registerOOBUser, an error occurred:", error);
    throw error;
  } finally {
    connection.release();
  }
}

async function getSettings() {
  const connection = await pool.getConnection();

  try {
    let settingsJson = null;
    [queryResults, columns] = await connection.query(sqlStrings.settingsQuery);
    if (queryResults) {
      settingsJson = queryResults[0].Data;
    }
    return settingsJson;
  } catch (error) {
    console.error("getSettings, an error occurred:", error);
    throw error;
  } finally {
    connection.release();
  }
}

async function checkOOBMode() {
  const connection = await pool.getConnection();
  try {
    const settingsJSON = await getSettings();
    return settingsJSON.oob_mode
  } catch (error) {
  } finally {
    connection.release();
  }
}

async function getUserFido2Entry(id) {
  const connection = await pool.getConnection();
  try {
    const [results, columns] = await connection.query(sqlStrings.getUserFidoEntries, [id]);
    if (results) {
      return (results[0]);
    }
  } catch (error) {
    throw error;
  } finally {
    connection.release();
  }
}

async function getTransactions() {
  const connection = await pool.getConnection();
  var query = sqlStrings.transQueryBase;

  // if (limit) {
  //   query = query + " LIMIT ?, ?";
  // }

  try {
    const [results, columns] = await connection.query(query, []);
    // const [countResult, columns2] = await connection.query(sqlStrings.transQueryCount);

    // const totalTransactions = countResult[0].total;
    // const totalPages = limit == null ? 0 : Math.ceil(totalTransactions / limit);

    // Format dates before rendering
    const formattedTransactions = results.map((transaction) => ({
      ...transaction,
      PostDate: helper.formatDate(transaction.PostDate),
      Month: helper.formatMonthWord(transaction.PostDate),
      TransDate: helper.formatDate(transaction.TransDate),
    }));

    return {formattedTransactions: formattedTransactions};

  } catch (error) {
    console.log(`getTransaction error: ${error}`);
  } finally {
    connection.release();
  }

}

  async function getMonthlyChargers(offset, limit) {
    const connection = await pool.getConnection();
    var query = sqlStrings.monthly.chargerQuery;

    if (limit) {
      query = query + " LIMIT ?, ?";
    }

    try {
      const [results, columns] = await connection.query(query, [offset, limit]);
      const [countResult, columns2] = await connection.query(sqlStrings.monthly.chargerQueryTotals);

      const totalTransactions = countResult[0].total;
      const totalPages = limit == null ? 0 : Math.ceil(totalTransactions / limit);
      
      //Fix up dates
      const formattedTransactions = results.map((transaction) => ({
        ...transaction,
        Month: helper.formatMonth(`${transaction.Year}-${transaction.Month}-1`),
        Amount: helper.formatCurrency(transaction.Amount),
      }));

      return {formattedTransactions: formattedTransactions, totalPages: totalPages};

    } catch (error) {
      console.log(`getMonthlyChargers error: ${error}`);
    } finally {
      connection.release();
    }


  }

  async function getMerchants() {
    const connection = await pool.getConnection();

    try {
      const [result, columns] = await connection.query(sqlStrings.getMerchantsQuery, []);
      return result;

    } catch (error) {
      console.log(`getMerchants error: ${error}`);
    } finally {
      connection.release();
    }
  }
module.exports = {
  checkOOBMode: checkOOBMode,
  createOOBUser: registerOOBUser,
  getSettings: getSettings,
  getUserFido2Entry: getUserFido2Entry,
  getTransactions: getTransactions,
  getMonthlyChargers: getMonthlyChargers,
  getMerchants: getMerchants
};
