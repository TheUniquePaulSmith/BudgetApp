function doPassKeyLogin() {
  var alertList = document.querySelectorAll(".alert");
  alertList.forEach(function (alert) {
    new bootstrap.Alert(alert);
  });
}

function createErrorAlert(message) {
  const button = document.createElement("button");
  const alerter = document.createElement("div");

  button.className = "btn-close";
  button.setAttribute("data-bs-dismiss", "alert");
  button.setAttribute("aria-label", "Close");

  alerter.className = "alert alert-danger alert-dismissible fade show";
  alerter.setAttribute("role", "alert");
  alerter.innerText = message;

  alerter.appendChild(button);

  document.getElementById("alertPlaceholder").appendChild(alerter);
}

function validateRegistrationInfo(challenge) {
  if (challenge === "") {
    createErrorAlert("Server challenge is invalid");
    return false;
  }
  if (document.forms["registerForm"].InputUsername.value === "") {
    createErrorAlert("Please enter a username");
    return false;
  }
  if (document.forms["registerForm"].InputPassword.value === "") {
    createErrorAlert("Please enter one time generated password");
    return false;
  }
  return true;
}

async function performWebAuthNRegistration(challenge) {
  if (validateRegistrationInfo(challenge) == false) {
    return false;
  }

  const utf8Decoder = new TextDecoder("utf-8");
  var name = document.forms["registerForm"].InputUsername.value;
  var id = new URL(window.location.href).hostname;

  if (typeof PublicKeyCredential == "undefined") {
    createErrorAlert("Your browser doesn't support WebAuthN or PassKeys");
  }
  const publicKeyCredentialCreationOptions = {
    challenge: Uint8Array.from(challenge, (c) => c.charCodeAt(0)),
    rp: {
      name: "P&T BudgetApp",
      id: id,
    },
    user: {
      id: Uint8Array.from("UZSL85T9AFC", (c) => c.charCodeAt(0)),
      name: name,
      displayName: name,
    },
    pubKeyCredParams: [
      { alg: -7, type: "public-key" },
      { type: "public-key", alg: -257 },
    ],
    authenticatorSelection: {
      authenticatorAttachment: "platform",
    },
    timeout: 60000,
    attestation: "none",
  };

  try {
    const cred = await navigator.credentials.create({
      publicKey: publicKeyCredentialCreationOptions,
    });

    decodedClientData = utf8Decoder.decode(cred.response.clientDataJSON);

    //Parse the response to send to server
    var fido2cred = JSON.stringify({
      Id: cred.id,
      Challenge: atob(JSON.parse(decodedClientData).challenge),
      Domain: new URL(JSON.parse(decodedClientData).origin).hostname,
      Type: cred.authenticatorAttachment,
      bPublicKey: btoa(new Uint8Array(cred.response.getPublicKey())),
      bAuthData: btoa(new Uint8Array(cred.response.getAuthenticatorData())),
      bClientRegJSONData: btoa(decodedClientData),
    });

    $("input[name=fido2cred]").val(fido2cred);
    document.forms["registerForm"].submit();
  } catch (error) {
    createErrorAlert("Authenticator Registration Error: " + error);
    return false;
  }
}

async function performWebAuthNLogin(challenge) {
  if (typeof PublicKeyCredential == "undefined") {
    window.location.href = "/?loginError=Client does not support passkeys";
  }

  const utf8Decoder = new TextDecoder("utf-8");

  const publicKeyCredentialRequestOptions = {
    challenge: Uint8Array.from(challenge, (c) => c.charCodeAt(0)),
    timeout: 60000,
  };

  const assertion = await navigator.credentials.get({
    publicKey: publicKeyCredentialRequestOptions,
  });

  const fido2payload = JSON.stringify({
    Id: assertion.id,
    bAuthenticatorData: btoa(
      new Uint8Array(assertion.response.authenticatorData)
    ),
    bClientDataJSON: btoa(
      utf8Decoder.decode(assertion.response.clientDataJSON)
    ),
    bSignature: btoa(new Uint8Array(assertion.response.signature)),
    UserHandle: utf8Decoder.decode(assertion.response.userHandle),
  });

  $("input[name=fido2cred]").val(fido2payload);
  document.forms["loginForm"].submit();
}

function confirmDelete(id, name) {
  if (confirm("Are you sure you want to delete '" + name + "'?")) {
    alert("Deleted " + id);
  } else {
  }
}

function sumTableRows(tableId) {
  // Get the table element by its ID
  const table = document.getElementById(tableId);

  // Check if the table exists
  if (!table) {
    console.error("Table with ID", tableId, "not found.");
    return;
  }

  // Initialize the sum variable
  let sum = 0;
  let rowId = 0;
  let startRow = tf.getStartRowIndex();

  // Loop through each row in the table
  for (const row of table.rows) {
    //check if the row is visible
    if (row.style.display !== "none" && rowId >= startRow) {
      //Grab cell 4
      var cellText = row.cells[4].innerText;
      cellText = cellText.replace("$","");

      const value = parseFloat(cellText);

      if (!isNaN(value)) {
        sum += value
      } else {
        console.warn("Non-numeric value found in row:", row);
      }
    }
    rowId = rowId+=1;
  }

  // Return the calculated sum
  return sum;
}
 
function calcAll(tf, colOps, colIndex) {
    calc(tf, colOps, colIndex, 'sum', true, 'vis-sum');
    calc(tf, colOps, colIndex, 'sum', false, 'flt-sum');

    calc(tf, colOps, colIndex, 'mean', true, 'vis-mean');
    calc(tf, colOps, colIndex, 'mean', false, 'flt-mean');

    // calc(tf, colOps, colIndex, 'median', true, 'vis-median');
    // calc(tf, colOps, colIndex, 'median', false, 'flt-median');

    calc(tf, colOps, colIndex, 'min', true, 'vis-min');
    calc(tf, colOps, colIndex, 'min', false, 'flt-min');

    calc(tf, colOps, colIndex, 'max', true, 'vis-max');
    calc(tf, colOps, colIndex, 'max', false, 'flt-max');
}

function calcAllMM(tf, colOps, colIndex) {
  calc(tf, colOps, colIndex, 'sum', true, 'mm-vis-sum');
  calc(tf, colOps, colIndex, 'sum', false, 'mm-flt-sum');

  calc(tf, colOps, colIndex, 'mean', true, 'mm-vis-mean');
  calc(tf, colOps, colIndex, 'mean', false, 'mm-flt-mean');

  // calc(tf, colOps, colIndex, 'median', true, 'vis-median');
  // calc(tf, colOps, colIndex, 'median', false, 'flt-median');

  calc(tf, colOps, colIndex, 'min', true, 'mm-vis-min');
  calc(tf, colOps, colIndex, 'min', false, 'mm-flt-min');

  calc(tf, colOps, colIndex, 'max', true, 'mm-vis-max');
  calc(tf, colOps, colIndex, 'max', false, 'mm-flt-max');
}

function calcAllMC(tf, colOps, colIndex) {
  calc(tf, colOps, colIndex, 'sum', true, 'mc-vis-sum');
  calc(tf, colOps, colIndex, 'sum', false, 'mc-flt-sum');

  calc(tf, colOps, colIndex, 'mean', true, 'mc-vis-mean');
  calc(tf, colOps, colIndex, 'mean', false, 'mc-flt-mean');

  // calc(tf, colOps, colIndex, 'median', true, 'vis-median');
  // calc(tf, colOps, colIndex, 'median', false, 'flt-median');

  calc(tf, colOps, colIndex, 'min', true, 'mc-vis-min');
  calc(tf, colOps, colIndex, 'min', false, 'mc-flt-min');

  calc(tf, colOps, colIndex, 'max', true, 'mc-vis-max');
  calc(tf, colOps, colIndex, 'max', false, 'mc-flt-max');
}

function calcAllYM(tf, colOps, colIndex) {
  calc(tf, colOps, colIndex, 'sum', true, 'ym-vis-sum');
  calc(tf, colOps, colIndex, 'sum', false, 'ym-flt-sum');

  calc(tf, colOps, colIndex, 'mean', true, 'ym-vis-mean');
  calc(tf, colOps, colIndex, 'mean', false, 'ym-flt-mean');

  // calc(tf, colOps, colIndex, 'median', true, 'vis-median');
  // calc(tf, colOps, colIndex, 'median', false, 'flt-median');

  calc(tf, colOps, colIndex, 'min', true, 'ym-vis-min');
  calc(tf, colOps, colIndex, 'min', false, 'ym-flt-min');

  calc(tf, colOps, colIndex, 'max', true, 'ym-vis-max');
  calc(tf, colOps, colIndex, 'max', false, 'ym-flt-max');
}


  /**
     * Perform a specified calculation on a column and display result
     * @param  {Object}  tf          TableFilter instance
     * @param  {Object}  colOps      ColOps extension instance
     * @param  {Number}  colIndex    Column index
     * @param  {String}  operation   Calculation to be performed ('sum', 'mean', 'median'...)
     * @param  {Boolean} onlyVisible Perform calculation on only visible data as opposed to filtered data
     * @param  {String}  labelId     Id of DOM element displaying calculation result
     */
  function calc(tf, colOps, colIndex, operation, onlyVisible, labelId) {

    /** getFilteredDataCol accepts in order of appearance:
        - a column index
        - an optional boolean indicating whether the returned dataset also includes the colunm header
        - an optional boolean indicating whether the returned dataset should return numbers (string by default)
        - an optional array of row indexes to be excluded from the returned dataset
        - an optional boolean indicating whether the returned dataset should only include filtered and
        visible data (true by default) or filtered only (paging can contain filtered data which is not visible)
        Refer to: http://koalyptus.github.io/TableFilter/docs/class/src/tablefilter.js~TableFilter.html#instance-method-getFilteredDataCol
    */
    var colValues = tf.getFilteredDataCol(colIndex, false, true, [], onlyVisible);
    var result = 0;

    // Refer to ColOps API to perform desired calculations
    // http://koalyptus.github.io/TableFilter/docs/class/src/extensions/colOps/colOps.js~ColOps.html
    if(operation === 'sum') {
        result = colOps.calcSum(colValues);
    }
    else if(operation === 'mean') {
        result = colOps.calcMean(colValues) || 0;
    }
    else if(operation === 'median') {
        result = colOps.calcMedian(colValues) || 0;
    }
    else if(operation === 'min') {
        let calc = colOps.calcMin(colValues);
        result = isFinite(calc) ? calc : 0;
    }
    else if(operation === 'max') {
        let calc = colOps.calcMax(colValues);
        result = isFinite(calc) ? calc : 0;
    }

    // display result
    document.getElementById(labelId).innerHTML =  formatCurrency(result.toFixed(2));
}

function formatCurrency(number) {
  // Create our number formatter.
  const formatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',

  // These options are needed to round to whole numbers if that's what you want.
  //minimumFractionDigits: 0, // (this suffices for whole numbers, but will print 2500.10 as $2,500.1)
  maximumFractionDigits: 0, // (causes 2500.99 to be printed as $2,501)
  });
  return formatter.format(number);
}


function performUpload() {

  //Hide the forms
  $("#uploadSuccessAlert").attr("hidden", true);
  $("#uploadFailureAlert").attr("hidden", true);

  $("#uploadSpinner").attr("hidden", null);
  $("#uploadBtn").attr("disabled", true);

  const formData = new FormData();
  const fileField = document.querySelector('input[type="file"]');

  formData.append("optType", (document.querySelector('select').value))
  formData.append("inputFile", fileField.files[0]);
  formData.append("gridCheck1", ($("#gridCheck1")[0].checked))
  formData.append("patternMatch", ($("#patternMatch")[0].checked))

  fetch("/upload", {
    method: "POST",
    mode: "cors",
    cache: "no-cache",
    body: formData
  }
  ).then((respObj) => {
    respObj.json().then((resp) => {
      if (resp.status == "success") {
        showUploadSuccess(resp);
      } else {
        showUploadFailure(resp.message);
      }
    });
  }).catch((err) => {
    console.error("Upload failed - ". err);
    showUploadFailure("Failed", err)
  })

  document.forms['uploadForm'].reset();

}

function showUploadSuccess(resp) {
  $("#totalRecords").text(resp.records);
  $("#numConflicts").text(resp.conflicts);
  $("#numUploaded").text(resp.uploaded);
  $("#numDuplicates").text(resp.duplicate);
  $("#uploadSuccessAlert").attr("hidden",null);
 
  $("#uploadSpinner").attr("hidden", true);
  $("#uploadBtn").attr("disabled", false);


}

function showUploadFailure(message) {
  $("#failureDetails").text(message);
  $("#uploadFailureAlert").attr("hidden",null);

  $("#uploadSpinner").attr("hidden", true);
  $("#uploadBtn").attr("disabled", false);

}