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
const appName = process.env.appName || process.env.npm_package_name || "P&T Budget App";
const PORT = process.env.PORT || 3000;
const SESSION_SECRET =
  process.env.SESSION_SECRET || crypto.randomBytes(32).toString("hex");
const INITIALP = process.env.INITIALP || randomstring.generate(12);
const DOMAINNAME = process.env.DOMAINNAME || "ptbudgetapp.home.fractalengine.com";

// Certificate Setup
const sslOptions = {
  key: fs.readFileSync("./keys/fractalengine.com.key"),
  cert: fs.readFileSync("./keys/fractalengine.com.crt"),
};

//Create the main app
const app = express();

//Set the title
app.set("appName", appName);
app.set("domainName", DOMAINNAME);

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

//Publish Static JQuery files
app.use("/js", express.static(path.join(".", "node_modules/jquery/dist")));

//Publish Static TableFilter files
app.use("/js/tablefilter", 
  express.static(path.join(".", "node_modules/tablefilter/dist/tablefilter")));

//Publish Static Canvas Charts files
  app.use("/js/canvasjs", express.static(path.join(".", "node_modules/@canvasjs/charts")));

//Publish Static chart.js Files
app.use("/js/chart.js", express.static(path.join(".", "node_modules/chart.js/dist")));

//DEBUG / TEST ROUTES
app.get("/test", (req, res) => {
  
  res.render("test", {
    username: null,
    location: "test",
    app
  });
});

//Register defined routes
routes.setupRoutes(app);

// Start server
https.createServer(sslOptions, app).listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
