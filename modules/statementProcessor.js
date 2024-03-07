const sqlClient = require("./sqlClient");

async function processHuntingtonFile(parsedData) {
    //Output stats
    let totalRecords = 0;
    let numConflicts = 0;
    let alreadyPosted = 0;
    let uploaded = 0;

  try {
    //check headers meet expectation
    var headerRow = parsedData.slice(0, 1)[0];
    validateHeaderRow(headerRow);

    //Grab all chargers so we don't have to requery each row
    var chargersRec = await sqlClient.getChargers();

    //Begin SQL Transaction for rollback
    var trans = await sqlClient.beginTransaction();

    //create an array of promises
    const promises = parsedData.slice(1).map(async (row, i) => {
      //Validate each row has same header count and property type
      if (row.length !== 12) {
        throw `Invalid row ${i}`;
      }

      validateDataRow(row, i);

      //Sanitize the data
      var saneRec = sanitizeRecord(row);

      //Check if row contains referencenumber (Interest transactions do not)
      var hasRefId = saneRec[9].length > 0;

      if (hasRefId) {
        //Query database to see if transaction is already uploaded
        //It can be common that the merchant tacks on charges to the same instance
        const conflictResult = await sqlClient.findTransactionByReference(
          saneRec[9]
        );
        if (conflictResult.length > 0) {
          if (!isDuplicate(conflictResult, saneRec)) {
            //Handle non-duplicate transactions
            console.log("Will create: " + JSON.stringify(saneRec));
            uploaded += 1;
          } else {
            alreadyPosted += 1;
          }
          numConflicts += 1;
        } else {
          //Upload new transactions
          await insertNewTransaction(sqlClient, saneRec, chargersRec);
          uploaded += 1;
        }
      }

      i = i + 1;
      totalRecords += 1;
    });

    //Wait for all promises to be completed
    await Promise.all(promises);

    //Commit the transactions
    await sqlClient.commitTransaction(trans);

  } catch (error) {
    console.log(`processHuntingtonFile error - ${error}`)
  }

  return {
    status: "success",
    records: totalRecords,
    conflicts: numConflicts,
    uploaded: uploaded,
    duplicate: alreadyPosted,
  };
}

async function insertNewTransaction(sqlClient, saneRec, chargersRec) {
  //Find matching Chargers
  let chargerAccount = chargersRec.find((rec) => rec.AccountMask == saneRec[0]);
  let ownerAccount = chargersRec.find((rec) => rec.AccountMask == saneRec[1]);

  if (chargerAccount == undefined) {
    throw `Unable to find charger account by mask - ${saneRec[0]}`;
  }
  if (ownerAccount == undefined) {
    throw `Unable to find owner account by mask - ${saneRec[1]}`;
  }



  //Find Company based on Merchant charge
  //Find matching Categories
  //Find matching budgets
}

function validateHeaderRow(headerRow) {
  if (headerRow.length !== 12) {
    throw "Invalid header length";
  }

  if (
    !(
      headerRow.includes("Original Account Number") &&
      headerRow.includes("Account Number") &&
      headerRow.includes("Transaction Date") &&
      headerRow.includes("Posting Date") &&
      headerRow.includes("Billing Amount") &&
      headerRow.includes("Merchant") &&
      headerRow.includes("Merchant City") &&
      headerRow.includes("Merchant Zip") &&
      headerRow.includes("Reference Number") &&
      headerRow.includes("Debit/Credit Flag") &&
      headerRow.includes("MCC Code")
    )
  ) {
    throw "Header row is invalid";
  }
}

function validateDataRow(row, num) {
  try {
    if (!isNumeric(row[0].replaceAll(".", ""))) {
      throw "Column 0 is not numeric";
    } //Original Account Number
    if (!isNumeric(row[1].replaceAll(".", ""))) {
      throw "Column 1 is not numeric";
    } //Account Number
    if (isNaN(Date.parse(row[2]))) {
      throw "Column 2 is invalid Date";
    } //Transaction Date
    if (isNaN(Date.parse(row[3]))) {
      throw "Column 3 is invalid Date";
    } // Posting Date
    if (!isNumeric(row[4].replace("$", ""))) {
      throw "Column 4 is not numeric";
    } // Billing Amount
    if (row[5].length === 0) {
      throw "Column 5 is empty";
    } // Merchant
    if (row[6].length === 0 && row[5] !== "Interest") {
      throw "Column 6 is empty";
    } // Merchant City
    if (row[7].length === 0 && row[5] !== "Interest") {
      throw "Column 7 is empty";
    } // Merchant State
    //Skip this one // Merchant Zip
    if (row[9].length === 0 && row[5] !== "Interest") {
      throw "Column 9 is empty";
    } // Reference Number
    if (row[10].length === 0) {
      throw "Column 10 is empty";
    } // Debit/Credit Flag
    //Skip this one // MCC Code
  } catch (error) {
    console.error(`validateDataRow failed on row ${num} - ${error}`);
    return false;
  }
}

function isNumeric(str) {
  if (typeof str != "string") return false; // we only process strings!
  return (
    !isNaN(str) && // use type coercion to parse the _entirety_ of the string (`parseFloat` alone does not do this)...
    !isNaN(parseFloat(str))
  ); // ...and ensure strings of whitespace fail
}

function sanitizeRecord(row) {
  var tmp = row;

  //Strip masking characters
  tmp[0] = tmp[0].replaceAll(".", "");
  tmp[1] = tmp[1].replaceAll(".", "");

  //Flip the debit and credit
  tmp[4] = tmp[4] * -1;
  return tmp;
}

function isDuplicate(dbrec, saneRec) {
  var result = false;
  for (let i = 0; i < dbrec.length; i++) {
    if (
      //Check charger is the same
      dbrec[i].charger === saneRec[0] &&
      //Check if owner account is same
      dbrec[i].actowner === saneRec[1] &&
      //Check if posted date & transaction date is the same
      dbrec[i].TransDate.getTime() === new Date(saneRec[2]).getTime() &&
      dbrec[i].PostDate.getTime() === new Date(saneRec[3]).getTime() &&
      //Check that the amount is the same
      new Number(dbrec[i].Amount) == saneRec[4] &&
      //Check that the merchant is the same
      dbrec[i].Merchant == saneRec[5]
    ) {
      result = true;
    }
  }

  return result;
}

module.exports = {
  processHuntingtonFile: processHuntingtonFile,
};
