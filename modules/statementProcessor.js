const sqlClient = require("./sqlClient");

async function processHuntingtonFile(parsedData) {
  //check headers meet expectation
  var headerRow = parsedData.slice(0, 1)[0];
  validateHeaderRow(headerRow);

  //Loop through each row
  var i = 1;
  await parsedData.slice(1).forEach(async (row) => {
    //Validate each row has same header count and property type
    if (row.length !== 12) {
      throw `Invalid row ${i}`;
    }
    validateDataRow(row, i);

    //Check if row contains referencenumber (Interest transactions do not)
    var hasRefId = row[9].length > 0;

    if (hasRefId) {
      //Query database to see if transaction is already uploaded
      const conflictResult = await sqlClient.findTransactionByReference(row[9])
        if (conflictResult.length > 0) {
          console.log(`Conflict - ${conflictResult[0]['ReferenceNumber']}`);
        }
    }
    i = i + 1;
  });

  //Handle duplicate transactions

  //Upload new transactions

  //Find matching Chargers
  //Find matching Merchants
  //Find matching Categories
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

module.exports = {
  processHuntingtonFile: processHuntingtonFile,
};
