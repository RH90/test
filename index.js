const express = require("express");
var sqlite3 = require("sqlite3").verbose();
const app = express();
const dotenv = require("dotenv");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt");
const path = require("path");
const bodyParser = require("body-parser");
var cookieParser = require("cookie-parser");

const saltRounds = 10;

dotenv.config();

const port = 3333;

var db = new sqlite3.Database("skåp.db");

// bcrypt.hash("admin", saltRounds, function (err, hash) {
//   console.log(hash);
//   db.run(
//     "create table IF NOT EXISTS users(username TEXT primary key, password TEXT not null);"
//   );
//   db.run("insert into users(username,password) values(?,?)", ["admin", hash]);
// });
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(cookieParser());

app.set("view engine", "pug");

var middleware = function (req, res, next) {
  console.log("Time:", Date.now());
  //console.log(req.route);
  console.log(req.originalUrl);

  console.log("token:" + req.cookies.token);
  if (req.originalUrl == "/login" || req.originalUrl == "/auth") {
    console.log("login!!,auth");
    next();
  } else if (req.cookies) {
    try {
      console.log("chech cookie");
      const decoded = jwt.verify(req.cookies.token, process.env.TOKEN_SECRET);
      console.log("decoded" + decoded);
      const token = jwt.sign(
        { username: decoded.username },
        process.env.TOKEN_SECRET,
        {
          expiresIn: "1h",
        }
      );
      console.log("token: " + token);
      console.log(decoded);
      res.cookie("token", token);
      console.log();
      next();
    } catch {
      console.log("error decode");
      res.redirect("/login");
      res.end();
    }
  } else {
    res.redirect("/login");
  }
  //next();
};

app.use(middleware);

verifytoken = function (token, secret, callback) {
  jwt.verify(token, secret, function (err, vt) {
    if (err) {
      // decide what to do with the error...
      callback(false);
    } else {
      console.log(vt);
      callback(vt);
    }
  });
};
app.all("/", (req, res) => {
  res.redirect("/skap");
});
app.all("/skap/:lockerNumb", (req, res) => {
  console.log(req.params.lockerNumb);
  //res.redirect("/skap");
  res.sendStatus(404);
});

app.all("/skap", (req, res) => {
  //console.log(process.env.TOKEN_SECRET);
  var search = "";
  if (req.body && req.body.search) {
    search = req.body.search.toLowerCase();
    //console.log("Search: " + search);
  }
  console.log("search: " + search);
  var query =
    "select " +
    " locker.id,locker.keys,locker.floor,locker.status,locker.number,locker.owner_id,grade,pupil.year,classP,firstname,lastname" +
    " from locker " +
    " left join pupil on pupil.id = locker.owner_id " +
    " where instr(LOWER(firstname), ?) > 0 OR instr(LOWER(lastname), ?) > 0 OR locker.number=?" +
    " OR (instr(?, LOWER(firstname)) > 0 AND instr(?, LOWER(lastname)) > 0) OR ?=''";
  db.all(query, [search, search, search, search, search, search], function (
    err,
    rows
  ) {
    //console.log(rows[0]);
    res.render("locker", {
      title: "Guru",
      message: "Welcome",
      img: {
        src:
          "https://www.guru99.com/images/NodeJS/010716_0613_NodejsExpre7.png",
      },
      list: { 1: { namn: 1, plan: 2 }, 2: { namn: 300, plan: 3 } },
      rows,
      searchRes: rows.length + ' results for: "' + search + '"',
      statusLockerText,
      statusLockerColor,
    });
  });
});
app.get("/logout", (req, res) => {
  res.cookie("token", "");
  res.send("Logged out!");
});
app.get("/login", (req, res) => {
  res.sendFile(path.join(__dirname + "/login.html"));
});
app.post("/auth", (req, res) => {
  console.log(req.body);
  if (req.body) {
    db.get(
      "select * from users where username=?",
      [req.body.username],
      (err, row) => {
        if (err) {
          console.error(err.message);
          res.sendStatus(404);
        } else if (!row) {
          res.sendStatus(401);
        } else {
          console.log(row.username);
          console.log(row.password);
          bcrypt.compare(req.body.password, row.password, function (
            err,
            resCrypt
          ) {
            if (resCrypt) {
              //request.session.token
              const token = jwt.sign(
                { username: row.username },
                process.env.TOKEN_SECRET,
                {
                  expiresIn: "1h",
                }
              );
              console.log(token);
              res.cookie("token", token);
              res.redirect("/skap");
            } else {
              res.sendStatus(401);
            }
            res.end();
          });
        }
      }
    );
  }
});

app.listen(port, () => {
  console.log(`Example app listening at http://localhost:${port}`);
});

const statusLockerText = {
  0: "ELEVE HAR SLÅPET",
  1: "LÅST AV SKOLAN",
  2: "ELEV MED EGET LÅS",
  3: "SKÅPET REPARERAS",
  4: "LÅST M. MULTILÅS",
  5: "ELEV MED DED. SKÅP",
  6: "ANVÄNDS EJ",
  7: "UTAN NYCKEL ELEVINNEHÅLL",
};
const statusLockerColor = {
  0: "LIMEGREEN",
  1: "PINK",
  2: "YELLOW",
  3: "ORANGE",
  4: "BLUE",
  5: "GRAY",
  6: "LIGHTGRAY",
  7: "purple",
};
