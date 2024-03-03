// Main App Modules
const express = require("express");
const https = require("https"),
  fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const session = require("express-session");
const correlator = require("express-correlation-id");
const randomstring = require("randomstring");
const routes = require("./modules/routes");

// App Config Variables
const appName = process.env.npm_package_name || process.env.appName || "P&T Budget App";
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

//Create the main app
const app = express();
app.set("appName", appName);

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

//Register defined routes
routes.setupRoutes(app);

// Start server
https.createServer(sslOptions, app).listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
