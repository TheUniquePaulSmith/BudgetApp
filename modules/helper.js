const os = require("os");
const crypto = require("crypto");
const dateFormat = require("dateformat");

class helper {
  static formatDate(dateString) {
    const date = new Date(dateString);
    const formattedDate = new Intl.DateTimeFormat("en-US", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(date);
    return formattedDate;
  }

  static formatMonth(dateString) {
    var now = new Date();
    dateFormat.masks.monthlyFormat = 'mmmm - yy';
    return dateFormat(dateString, dateFormat.masks.monthlyFormat);
  }

  static formatMonthWord(dateString) {
    var now = new Date();
    dateFormat.masks.monthlyFormat = 'mmmm';
    return dateFormat(dateString, dateFormat.masks.monthlyFormat);
  }

  static formatCurrency(number) {
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

  static generateChallenge(requestId) {
    return requestId;
  }

  static keyChunk64(payload) {
    var result = "";
    const chunkSize = 64;
    if (payload.length > 0) {
      for (let i = 0; i < payload.length; i += chunkSize) {
        result += payload.slice(i, i + chunkSize) + os.EOL;
      }
    }
    return result;
  }

  static isValidFidoLogin(req, sqlClient, DOMAINNAME) {
    try {
        var cred = JSON.parse(req.body.fido2cred);
    var id = cred.Id;

    var authData = Buffer.from(cred.bAuthenticatorData, "base64").toString(
      "utf-8"
    );
    var clientDataJson = JSON.parse(
      Buffer.from(cred.bClientDataJSON, "base64").toString("utf-8")
    );
    var signature = Buffer.from(cred.bSignature, "base64").toString("utf-8");
    var challenge = Buffer.from(clientDataJson.challenge, "base64").toString(
      "utf-8"
    );
    var origin = new URL(clientDataJson.origin).hostname;

    var authDataBin = new Uint8Array(authData.split(","));
    var signatureBin = new Uint8Array(signature.split(","));

    //Verify challenge
    if (req.session.sChallenge !== challenge) {
      throw "Invalid challenge";
    }

    //Verify attestation origin matches server origin
    if (DOMAINNAME.toLowerCase() !== origin.toLowerCase()) {
      throw "Invalid origin";
    }

    //Create hashed client data
    var hashedClientData = crypto
      .createHash("sha256")
      .update(JSON.stringify(clientDataJson))
      .digest();

    //Create signature used for verification
    var signedData = new Uint8Array([
      ...authDataBin,
      ...hashedClientData,
    ]);

    return sqlClient.getUserFido2Entry(id).then((row) => {
        var passkeys = row.PassKeys;
        var username = row.DisplayName;
      if (!passkeys) {
        throw "Invalid PassKey";
      }

      var pubkeyEncodedArray = Buffer.from(passkeys.bPublicKey, "base64")
        .toString("utf-8")
        .split(",");

      var pubKeySegment = Buffer.from(
        new Uint8Array(pubkeyEncodedArray)
      ).toString("base64");

      var pubkeyFormat =
        "-----BEGIN PUBLIC KEY-----" +
        os.EOL +
        helper.keyChunk64(pubKeySegment) +
        "-----END PUBLIC KEY-----";

      const verify = crypto.createVerify("SHA256");
      verify.write(signedData);
      verify.end();
      var isValid = verify.verify(pubkeyFormat, signatureBin);
      if (isValid) {
        return {isValid: isValid, username: username};
      }
      return {isValid: isValid, username: ''};
    });

    } catch (error) {
       console.log(`isValidFidoLogin Error: ${error}`) 
       throw error;
    }
  }
}

module.exports = helper;
