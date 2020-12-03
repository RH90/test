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
  console.log(req.method);
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
    "select * from pupil where not EXISTS(select * from locker where owner_id=pupil.id) ORDER BY grade,classP,lastname,firstname ASC";
  db.all(query, function (err, rows) {
    console.log(rows);
    res.render("giveLocker", {
      title: "Guru",
      lockerNumb: req.params.lockerNumb,
      message: "Give locker " + req.params.lockerNumb,
      img: {
        src:
          "https://www.guru99.com/images/NodeJS/010716_0613_NodejsExpre7.png",
      },
      list: { 1: { namn: 1, plan: 2 }, 2: { namn: 300, plan: 3 } },
      search: req.query.search,
      plan: req.query.plan,
      status: req.query.status,
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
  console.log(req.query);
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
        res.redirect(
          "/skap?search=" +
            req.body.search +
            "&plan=" +
            req.body.plan +
            "&status=" +
            req.body.status
        );
      }
    );
  } else {
    res.sendStatus(404);
  }
});
app.get("/skap/:lockerNumb", (req, res) => {
  console.log(req.params.lockerNumb);
  db.get(
    "select locker.id,keys,number,floor,status,owner_id,grade,classP,year,firstname,lastname,inschool " +
      " from locker left join pupil on pupil.id=locker.owner_id where number=?",
    [req.params.lockerNumb],
    function (err, row) {
      if (err || !row) {
        console.log(err);
        res.sendStatus(404);
      } else {
        db.all(
          "select type,comment,DATETIME(round(date/1000),'unixepoch') as date from history where origin=1 and owner_id=? ORDER by date DESC",
          [row.id],
          function (err, history) {
            //console.log(history);
            console.log(row);
            if (history) {
              console.log("history true");
            } else {
              history = {};
            }
            var statusSelected = {
              0: false,
              1: false,
              2: false,
              3: false,
              4: false,
              5: false,
              6: false,
              7: false,
              8: false,
            };
            //console.log(rows[0]);
            statusSelected[row.status] = true;
            //console.log(statusSelected);
            res.render("lockerinfo", {
              title: "Guru",
              lockerNumb: req.params.lockerNumb,
              message: req.params.lockerNumb,
              row,
              statusSelected,
              history,
            });
          }
        );
      }
    }
  );
});
app.get("/pupil/:pupilId", (req, res) => {
  console.log(req.params.pupilId);
  db.get(
    "select pupil.id,firstname,lastname,grade,classP,locker.number,year from pupil left join locker on pupil.id=locker.owner_id where pupil.id=?",
    [req.params.pupilId],
    function (err, row) {
      if (err || !row) {
        console.log(err);
        res.sendStatus(404);
      } else {
        db.all(
          "select type,comment,DATETIME(round(date/1000),'unixepoch') as date from history where origin=0 and owner_id=? ORDER by date DESC",
          [row.id],
          function (err, history) {
            //console.log(history);
            console.log(row);
            if (history) {
              console.log("history true");
            } else {
              history = {};
            }
            //console.log(statusSelected);
            res.render("pupilInfo", {
              title: "Guru",
              row,
              history,
            });
          }
        );
      }
    }
  );
});
app.post("/skap/:lockerNumb", (req, res) => {
  console.log(req.body);
  if (req.body && req.body["keys"]) {
    db.run(
      "update locker set keys=?,status=? where number=?",
      [req.body["keys"], req.body["status"], req.params.lockerNumb],
      function (err) {
        if (err) {
          console.log(err);
          res.sendStatus(404);
        } else {
          console.log("updateted");
          res.redirect("/skap/" + req.params.lockerNumb);
        }
      }
    );
  } else if (req.body && req.body["comment"]) {
    console.log(req.body["comment"]);
    db.get(
      "select id from locker where number=?",
      [req.params.lockerNumb],
      function (err, row) {
        if (err) {
          res.sendStatus(404);
          return;
        }

        const date = new Date();
        const origin = 1;
        const owner_id = row.id;
        db.run(
          "insert into history (origin, owner_id,type,comment,date) values(?,?,?,?,?)",
          [origin, owner_id, "comment", req.body["comment"], date],
          function (err) {
            if (err) {
              console.log(err);
              res.sendStatus(404);
            } else {
              console.log("updateted");
              res.redirect("/skap/" + req.params.lockerNumb);
            }
          }
        );
      }
    );
  } else {
    res.sendStatus(404);
  }
});

app.post("/pupil/:pupilId", (req, res) => {
  console.log(req.body);
  if (req.body && req.body["classP"]) {
    db.run(
      "update pupil set firstname=?,lastname=?,classP=?,grade=? where id=?",
      [
        req.body["firstname"],
        req.body["lastname"],
        req.body["classP"],
        req.body["grade"],
        req.params.pupilId,
      ],
      function (err) {
        if (err) {
          console.log(err);
          res.sendStatus(404);
        } else {
          console.log("updateted");
          res.redirect("/pupil/" + req.params.pupilId);
        }
      }
    );
  } else if (req.body && req.body["comment"]) {
    console.log(req.body["comment"]);
    const date = new Date();
    const origin = 0;
    const owner_id = req.params.pupilId;
    db.run(
      "insert into history (origin, owner_id,type,comment,date) values(?,?,?,?,?)",
      [origin, owner_id, "comment", req.body["comment"], date],
      function (err) {
        if (err) {
          console.log(err);
          res.sendStatus(404);
        } else {
          console.log("updateted");
          res.redirect("/pupil/" + req.params.pupilId);
        }
      }
    );
  } else {
    res.sendStatus(404);
  }
});

app.all("/pupil", (req, res) => {
  console.log("body");
  console.log(req.body);
  //console.log(process.env.TOKEN_SECRET);
  var search = "";
  if (req.body && req.body.search) {
    search = req.body.search.toLowerCase();
    //console.log("Search: " + search);
  }
  var query =
    "select " +
    " * " +
    " from pupil " +
    " where (instr(LOWER(firstname), ?) > 0 OR instr(LOWER(lastname), ?) > 0 " +
    " OR (instr(?, LOWER(firstname)) > 0 AND instr(?, LOWER(lastname)) > 0) OR ?='' " +
    " OR (grade||classP)=?) " +
    " ORDER BY grade,classP,lastname,firstname ASC";
  db.all(
    query,
    [search, search, search, search, search, search],
    function (err, rows) {
      console.log(err);
      //console.log(rows[0]);

      res.render("pupil", {
        title: "pupil",
        rows,
        search,
      });
    }
  );
});

app.all("/skap", (req, res) => {
  console.log("query");
  console.log(req.query);
  console.log(Object.keys(req.query).length);
  console.log("body");
  console.log(req.body);
  //console.log(process.env.TOKEN_SECRET);
  var search = "";
  if (req.body && req.body.search) {
    search = req.body.search.toLowerCase();
    //console.log("Search: " + search);
  }
  if (req.body.clearLocker) {
  }
  var plan = "";
  var status = "";
  if (Object.keys(req.query).length) {
    search = req.query.search;
    req.body.plan = req.query.plan;
    req.body.status = req.query.status;
  }

  if (req.body.plan && req.body.plan != -1) {
    plan = " and floor=" + req.body.plan;
  }
  if (req.body.status && req.body.status != -1) {
    status = " and status=" + req.body.status;
  }

  var query =
    "select " +
    " locker.id,locker.keys,locker.floor,locker.status,locker.number,locker.owner_id,grade,pupil.year,classP,firstname,lastname" +
    " from locker " +
    " left join pupil on pupil.id = locker.owner_id " +
    " where (instr(LOWER(firstname), ?) > 0 OR instr(LOWER(lastname), ?) > 0 OR locker.number=?" +
    " OR (instr(?, LOWER(firstname)) > 0 AND instr(?, LOWER(lastname)) > 0) OR ?='' " +
    " OR (grade||classP)=?) " +
    plan +
    status +
    " ORDER BY grade,classP,lastname,firstname,status ASC";
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
        floor: req.body.plan,
        status: req.body.status,
        statusLockerText,
        statusLockerColor,
      });
    }
  );
});
app.get("/login", (req, res) => {
  res.cookie("token", "");
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
