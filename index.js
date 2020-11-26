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
  console.log("\n");
  //next();
};

app.use(middleware);

app.all("/", (req, res) => {
  res.redirect("/skap");
});

app.all("/skap/:lockerNumb/geut", (req, res) => {
  console.log(req.params.lockerNumb);
  var query =
    "select * from pupil where not EXISTS(select * from locker where owner_id=pupil.id);";
  db.all(query, function (err, rows) {
    res.render("giveLocker", {
      title: "Guru",
      lockerNumb: req.params.lockerNumb,
      message: "Give locker " + req.params.lockerNumb,
      img: {
        src:
          "https://www.guru99.com/images/NodeJS/010716_0613_NodejsExpre7.png",
      },
      list: { 1: { namn: 1, plan: 2 }, 2: { namn: 300, plan: 3 } },
      rows,
    });
  });
});
app.all("/checkin", (req, res) => {
  console.log("Checkout");
  console.log(req.body);

  if (!req.body) {
    res.sendStatus(404);
  } else if (req.body.table == "locker") {
    db.run(
      "UPDATE locker set owner_id=null,status=1 where locker.number=?",
      [req.body.idItem],
      function (err) {
        if (err) {
          console.log(err.message);
        }
        console.log(this);
        res.sendStatus(200);
      }
    );
  } else {
    res.sendStatus(404);
  }
});

app.post("/checkout", (req, res) => {
  console.log("Checkout");
  console.log(req.body);

  if (!req.body) {
    res.sendStatus(404);
  } else if (req.body.table == "locker") {
    db.run(
      "UPDATE locker set owner_id=?,status=0 where locker.number=? AND locker.owner_id is NULL",
      [req.body.idPupil, req.body.idItem],
      function (err) {
        if (err) {
          console.log(err.message);
        }
        console.log(this);
        res.redirect("/skap");
      }
    );
  } else {
    res.sendStatus(404);
  }
});

app.all("/skap", (req, res) => {
  console.log(req.body);
  //console.log(process.env.TOKEN_SECRET);
  var search = "";
  if (req.body && req.body.search) {
    search = req.body.search.toLowerCase();
    //console.log("Search: " + search);
  }
  if (req.body.clearLocker) {
  }
  var query =
    "select " +
    " locker.id,locker.keys,locker.floor,locker.status,locker.number,locker.owner_id,grade,pupil.year,classP,firstname,lastname" +
    " from locker " +
    " left join pupil on pupil.id = locker.owner_id " +
    " where instr(LOWER(firstname), ?) > 0 OR instr(LOWER(lastname), ?) > 0 OR locker.number=?" +
    " OR (instr(?, LOWER(firstname)) > 0 AND instr(?, LOWER(lastname)) > 0) OR ?='' " +
    " OR (grade||classP)=?";
  db.all(
    query,
    [search, search, search, search, search, search, search],
    function (err, rows) {
      console.log(err);
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
        search,
        statusLockerText,
        statusLockerColor,
      });
    }
  );
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
          bcrypt.compare(
            req.body.password,
            row.password,
            function (err, resCrypt) {
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
            }
          );
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
