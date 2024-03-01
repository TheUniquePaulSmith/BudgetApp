// Main App Modules
const express = require("express");
const https = require("https"),
  fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const session = require("express-session");
const correlator = require("express-correlation-id");
const randomstring = require("randomstring");
const sqlClient = require("./modules/sqlClient");
const os = require("os");

// App Config Variables
const PORT = process.env.PORT || 3000;
const SESSION_SECRET =
  process.env.SESSION_SECRET || crypto.randomBytes(32).toString("hex");
const INITIALP = process.env.INITIALP || randomstring.generate(12);
const DOMAINNAME =
  process.env.DOMAINNAME || "ptbudgetapp.home.fractalengine.com";

// Certificate Setup
const sslOptions = {
  key: fs.readFileSync("./keys/fractalengine.com.key"),
  cert: fs.readFileSync("./keys/fractalengine.com.crt"),
};

//Helpers
const helper = require("./modules/helper");
const sqlStrings = require("./modules/sqlStrings");
const { off } = require("process");
const { resourceLimits } = require("worker_threads");

//Create the main app
const app = express();

// Set the View Engine for EJS
app.set("view engine", "ejs");

// Init Middleware
app.use(express.urlencoded({ extended: true }));
app.use(express.static("public"));
app.use(
  session({
    secret: SESSION_SECRET,
    resave: false,
    saveUninitialized: true,
  })
);
app.use(correlator());

// Publish Static Bootstrap files
app.use(
  "/css",
  express.static(path.join(".", "node_modules/bootstrap/dist/css"))
);
app.use(
  "/js",
  express.static(path.join(".", "node_modules/bootstrap/dist/js"))
);
app.use("/js", express.static(path.join(".", "node_modules/jquery/dist")));
app.use("/js/tablefilter", 
  express.static(path.join(".", "node_modules/tablefilter/dist/tablefilter")));

app.use("/js/canvasjs", express.static(path.join(".", "node_modules/@canvasjs/charts")));

//DEBUG / TEST ROUTES
app.get("/test", (req, res) => {
  console.log("ID for this request is:", req.correlationId()); // id for this request
  console.log("ID for this request is:", correlator.getId()); // equal to above, not dependant on the req object
  console.log(req.sessionID);
  res.end();
});

// Define Routes

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
            registerError: error,
            sChallenge: req.session.sChallenge,
          });
        }
      } else {
        res.render("oob", {
          registerError: "Invalid Registration",
          sChallenge: req.session.sChallenge,
        });
      }
    }
  });
});

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
      res.redirect('/dashboard');
    }
  });
});

app.get("/login", (req, res) => {
      if (req.session.loggedin) {
        res.redirect('/dashboard');
      } else {
        var loginError = req.query.loginError;
        let session = req.session;
        req.session.regenerate(function (err) {
          crypto.randomBytes(16, function (err, buffer) {
            req.session.sChallenge = buffer.toString("hex");
            req.session.loggedin = session.loggedin;
            res.render("login", {
              loginError,
              sChallenge: req.session.sChallenge,
            });
          });
        });
      }
    });

app.post("/login", (req, res) => {
  try {
    helper.isValidFidoLogin(req, sqlClient, DOMAINNAME).then((results) => {
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

app.get("/merchants", (req, res) => {
  const pageName = "merchants";

  sqlClient.getMerchants().then((merchants) => {

    res.render("merchants", {
      location: pageName,
      username: req.session.username,
      merchants
    });
  })
});

//Settings page
app.get("/settings", (req, res) => {
  if (req.session.loggedin) {
    res.render("settings");
  } else {
    res.redirect("/?loginError=Not Logged In");
  }
});

//Transaction Page
app.get("/transactions", (req, res) => {
  const pageName = "transactions";
  // const page = req.query.page || 1; // Get current page from query parameter, default to page 1
  // const limit = req.query.limit == "All" ? null : Number(req.query.limit) || 50; // Number of transactions per page
  // const offset = (page - 1) * limit; // Calculate offset

  sqlClient.getTransactions().then((result) => {
    res.render("transactions", {
      location: pageName,
      username: req.session.username,
      transactions: result.formattedTransactions
    });
  });
});

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

// Start server
https.createServer(sslOptions, app).listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
