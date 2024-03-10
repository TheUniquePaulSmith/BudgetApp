const sqlClient = require("./sqlClient");

async function processHuntingtonFile(parsedData) {
    //Output stats
    let totalRecords = 0;
    let numConflicts = 0;
    let alreadyPosted = 0;
    let uploaded = 0;

     //Begin SQL Transaction for rollback
     var trans = await sqlClient.beginTransaction();

  try {
    //check headers meet expectation
    var headerRow = parsedData.slice(0, 1)[0];
    validateHeaderRow(headerRow);

    //Grab all chargers so we don't have to requery each row
    var chargersRec = await sqlClient.getChargers();

    //Grab all merchants so we don't have to requery for each row
    var merchantsRec = await sqlClient.getMerchants();

    //create an array of promises
    const promises = parsedData.slice(1).map(async (row, i) => {
      //Validate each row has same header count and property type
      if (row.length !== 12) {
        throw `Invalid row ${i}`;
      }

      //Validate the data row contains expected datatypes and columns
      validateDataRow(row, i);

      //Sanitize the row for input
      var saneRec = sanitizeRecord(row);

      //Check if row contains referencenumber (Interest posted transactions do not since they aren't CC charges)
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
            await insertNewTransaction(sqlClient, saneRec, chargersRec);
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
      } else {
        //Post chargers like interest that do not have ReferenceNumber
        //validate we don't re-post the same interest charge by looking at dates + amount + merchant = Interest
        if (await isDuplicateInterest(saneRec)) {
          //Don't upload as already posted
          alreadyPosted += 1;
        } else {
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
    try {
      console.error(`processHuntingtonFile error - ${error}`)
      sqlClient.rollbackTransaction(trans);
    } catch (err) {
      console.error(`processHuntingtonFile - Rollback error ${err}`)
    }
    return {
      status: "error",
      message: error.message == null ? error : error.message,
    }
  }

  return {
    status: "success",
    records: totalRecords,
    conflicts: numConflicts,
    uploaded: uploaded,
    duplicate: alreadyPosted,
  };
}

async function insertNewTransaction(sqlClient, saneRec, chargersRec, merchantsRec) {
  //Find matching Chargers
  let chargerAccount = chargersRec.find((rec) => rec.AccountMask == saneRec[0])["Id"];
  let ownerAccount = chargersRec.find((rec) => rec.AccountMask == saneRec[1])["Id"];

  if (chargerAccount == undefined) {
    throw `Unable to find charger account by mask - ${saneRec[0]}`;
  }
  if (ownerAccount == undefined) {
    throw `Unable to find owner account by mask - ${saneRec[1]}`;
  }

  //Find Company based on Merchant charge by existing 
  var matchingMerchant = await sqlClient.findMatchingMerchant(saneRec[5]);
  
  sqlClient.insertNewTransaction(
    chargerAccount, //Original Account Number
    ownerAccount, //Account Number
    saneRec[2], //Transaction Date
    saneRec[3], //Posting Date
    saneRec[4], //Billing Amount
    saneRec[5], //Merchant
    matchingMerchant.length > 0 ? matchingMerchant[0].MerchantId : '', //Matching Merchant
    saneRec[6], //Merchant City
    saneRec[7], //Merchant State
    saneRec[9], //ReferenceNumber
    saneRec[10] //Flag
    );

  //Find matching Categories

  //Find matching budgets
  //TODO: Create budgets logic
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

  //Fix Date fields for MySQL - YYYY-MM-DD
  tmp[2] = (new Date(tmp[2])).toISOString().substring(0,10)
  tmp[3] = (new Date(tmp[3])).toISOString().substring(0,10)

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
      dbrec[i].TransDate.getTime() === new Date(saneRec[2]+' UTC').getTime() &&
      dbrec[i].PostDate.getTime() === new Date(saneRec[3]+ 'UTC').getTime() &&
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

async function isDuplicateInterest(saneRec) {
  const query = await sqlClient.lookUpTransactionInterest(
    saneRec[1],
    saneRec[2],
    saneRec[3],
    saneRec[4]
    );

    if (query && query.length > 0) {
      return true
    }
    return false;
}

module.exports = {
  processHuntingtonFile: processHuntingtonFile,
};
