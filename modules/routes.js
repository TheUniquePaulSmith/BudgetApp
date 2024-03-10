const sqlClient = require("./sqlClient");
const crypto = require("crypto");
const helper = require("./helper");
const multer = require('multer');
const upload = multer();
const fs = require('fs');
const csvParser = require('csv-parse');
const statementProcessor = require("./statementProcessor");

function getMain(app) {
  app.get("/", (req, res) => {
    //Load Settings from DB
    sqlClient.getSettings().then((settingsJson) => {
      const oob_mode = settingsJson.oob_mode;

      if (oob_mode) {
        //ADD OTP Routes{
        var registerError = req.query.registerError;
        let session = req.session;
        req.session.regenerate(function (err) {
          crypto.randomBytes(16, function (err, buffer) {
            req.session.sChallenge = buffer.toString("hex");
            req.session.loggedin = session.loggedin;
            res.render("oob", {
              registerError,
              sChallenge: req.session.sChallenge,
            });
          });
        });
      } else {
        //NOT OOB mode
        // Main Route
        res.redirect("/dashboard");
      }
    });
  });
}

function getLogin(app) {
  app.get("/login", (req, res) => {
    if (req.session.loggedin) {
      res.redirect("/dashboard");
    } else {
      var loginError = req.query.loginError;
      let session = req.session;
      req.session.regenerate(function (err) {
        crypto.randomBytes(16, function (err, buffer) {
          req.session.sChallenge = buffer.toString("hex");
          req.session.loggedin = session.loggedin;
          res.render("login", {
            app,
            loginError,
            sChallenge: req.session.sChallenge,
          });
        });
      });
    }
  });
}

function postLogin(app) {
  app.post("/login", (req, res) => {
    try {
      helper.isValidFidoLogin(req, sqlClient, app.get("domainName")).then((results) => {
        if (results.isValid) {
          req.session.loggedin = true;
          req.session.username = results.username;
          res.redirect("/dashboard");
        } else {
          res.render("login", {
            loginError: "Invalid Credentials",
            sChallenge: req.session.sChallenge,
          });
        }
      });
    } catch (error) {
      res.render("login", {
        loginError: `Unable to authenticate ${error}`,
        sChallenge: req.session.sChallenge,
      });
    }
  });
}

function postMain(app) {
  //Define POST route for registering credentials
  app.post("/", (req, res) => {
    sqlClient.getSettings().then((settingsJson) => {
      const oob_mode = settingsJson.oob_mode;

      if (oob_mode) {
        var payload = req.body.fido2cred;
        var username = req.body.InputUsername;
        var password = req.body.InputPassword;

        if (payload && username && password) {
          try {
            //Check if password matches OTP
            if (password !== INITIALP) {
              throw "Invalid Initial One-Time Password";
            }

            //Parse the JSON object
            var cred = JSON.parse(payload);

            //Check if challenge matches
            if (cred.Challenge !== req.session.sChallenge) {
              throw "Invalid Session Challenge";
            }

            //Check that FIDO2 domain matches current domain
            if (DOMAINNAME !== req.hostname || DOMAINNAME !== cred.Domain) {
              throw "Invalid Request for Relying Party";
            }

            //Insert the record into the database and turn off the OOB mode
            sqlClient
              .createOOBUser(
                (data = {
                  username: username,
                  disabled: 0,
                  cred: JSON.stringify(cred),
                })
              )
              .then(() => {
                res.redirect("/");
              });
          } catch (error) {
            res.render("oob", {
              app,
              registerError: error,
              sChallenge: req.session.sChallenge,
            });
          }
        } else {
          res.render("oob", {
            app,
            registerError: "Invalid Registration",
            sChallenge: req.session.sChallenge,
          });
        }
      }
    });
  });
}

function getDashboard(app) {
  //Home page
  app.get("/dashboard", (req, res) => {
    // if (req.session.loggedin) {
    const pageName = "dashboard";

    async function getData() {
      const monthlyChargers = await sqlClient.getMonthlyChargers();
      const monthlyMerchants = await sqlClient.getMonthlyMerchants();

      const yearlyChargers = await sqlClient.getYearlyChargers();
      const yearlyMerchants = await sqlClient.getYearlyMerchants();

      return res.render("dashboard", {
        app,
        location: pageName,
        username: req.session.username,
        monthlyChargerTransactions: monthlyChargers,
        monthlyMerchantTransactions: monthlyMerchants,
        yearlyChargerTransactions: yearlyChargers,
        yearlyMerchantTransactions: yearlyMerchants,
      });
    }

    return getData();

    // } else {
    //   res.redirect("/login?loginError=Not Logged In");
    // }
  });
}

function getMerchants(app) {
  app.get("/merchants", (req, res) => {
    const pageName = "merchants";

    sqlClient.getMerchants().then((merchants) => {
      res.render("merchants", {
        app,
        location: pageName,
        username: req.session.username,
        merchants,
      });
    });
  });
}

function getSettings(app) {
  //Settings page
  app.get("/settings", (req, res) => {
    if (req.session.loggedin) {
      res.render("settings", {
        app,
        username: req.session.username,
        location: "settings",
      });
    } else {
      res.redirect("/?loginError=Not Logged In");
    }
  });
}

function getTransactions(app) {
  //Transaction Page
  app.get("/transactions", (req, res) => {
    const pageName = "transactions";
    // const page = req.query.page || 1; // Get current page from query parameter, default to page 1
    // const limit = req.query.limit == "All" ? null : Number(req.query.limit) || 50; // Number of transactions per page
    // const offset = (page - 1) * limit; // Calculate offset

    sqlClient.getTransactions().then((result) => {
      res.render("transactions", {
        app,
        location: pageName,
        username: req.session.username,
        transactions: result.formattedTransactions,
      });
    });
  });
}

function postTransactions(app) {
  // Add this route after the edit transaction form route
  app.post("/transactions/:id/update", (req, res) => {
    const transactionId = req.params.id;
    const { description, amount } = req.body;
    sqlConnection.query(
      "UPDATE Transactions SET description = ?, amount = ? WHERE id = ?",
      [description, amount, transactionId],
      (error, results) => {
        if (error) {
          console.error("Error updating transaction:", error);
          res.status(500).send("Internal Server Error");
          return;
        }
        res.redirect("/transactions");
      }
    );
  });
}

function getUpload(app) {
    const pageName = 'upload'
    app.get("/upload", (req, res) => {
        res.render("upload", {
            app,
            location: pageName,
            username: req.session.username
        })
    })
}

function postUpload(app) {
    app.post("/upload", upload.single('inputFile'), (req, res) => {
        const data = req.file
        
        //There is uploaded file
        if (data) {
            var csvData=[];
            fs.ReadStream.from(data.buffer)
            .pipe(csvParser.parse({delimiter: ','}))
                .on('data', (data) => csvData.push(data))
                .on('end', () => {
                    //Process the Huntington File
                    statementProcessor.processHuntingtonFile(csvData).then((result) => {
                        res.send(JSON.stringify(result));
                    });
                })
                .on('error', (err) => {
                  //Return the error back to client
                  res.send(
                    {
                      status: "error",
                      message: err.message,
                    }
                  )
                  console.error(`csvParser error - ${err}`)
                })
        } else {
            res.send({
              status: "error",
              message: "No data submitted"
            });
        }
    });
}

function setupRoutes(app) {
  // GET - /
  getMain(app);

  // POST - /
  postMain(app);

  // Get - /login
  getLogin(app);

  // Post - /login
  postLogin(app);

  // Get - /dashbaord
  getDashboard(app);

  // Get - /merchants
  getMerchants(app);

  // Get - /settings
  getSettings(app);

  // Get - /transactions
  getTransactions(app);

  // POST - /transcations
  postTransactions(app);

  // Get - /upload
  getUpload(app);

  // POST - /upload
  postUpload(app);

  //Output secret if OOB Mode
  sqlClient.checkOOBMode().then((oob_mode) => {
    if (oob_mode) {
      console.log(
        "Out-of-box mode enabled, one time password:",
        "\x1b[32m",
        INITIALP
      );
    }
  });
}

module.exports = { setupRoutes }
