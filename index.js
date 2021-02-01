const express = require("express");
var sqlite3 = require("sqlite3").verbose();
const app = express();
const dotenv = require("dotenv");
var compression = require("compression");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt");
const path = require("path");
const bodyParser = require("body-parser");
var cookieParser = require("cookie-parser");
var favicon = require("serve-favicon");
const { type, networkInterfaces } = require("os");
const { json } = require("body-parser");
var serverWifiIP = {};
var Netmask = require("netmask").Netmask;
var block = null;
var localOnly = true;

dotenv.config();

const port = 80;

var db = new sqlite3.Database("db/database.db");
//hej
// or just '{}', an empty object
getNetwork();
setInterval(() => {
	getNetwork();
}, 5000);
function getNetwork() {
	try {
		var nets = networkInterfaces();
		var results = Object.create(null);
		for (const name of Object.keys(nets)) {
			for (const net of nets[name]) {
				// skip over non-ipv4 and internal (i.e. 127.0.0.1) addresses
				if (net.family === "IPv4" && !net.internal) {
					if (!results[name]) {
						results[name] = [];
					}
					results[name].push({ address: net.address, netmask: net.netmask });
				}
			}
		}

		if (results["Wi-Fi"] == undefined && serverWifiIP != "") {
			serverWifiIP = {};
			console.log("Current local ip: No wifi connection");
		} else if (results["Wi-Fi"][0].address != serverWifiIP.address) {
			serverWifiIP = results["Wi-Fi"][0];
			block = new Netmask(serverWifiIP.address + "/" + serverWifiIP.netmask);
			console.log(
				"Current local ip: http://" +
					serverWifiIP.address +
					":3333, mask: " +
					serverWifiIP.netmask
			);
		}
	} catch (error) {}
}

app.use(compression());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(cookieParser());
// app.use(favicon(path.join(__dirname, "/images/favicon.ico")));
// app.use("/images", express.static("images"));

app.set("view engine", "pug");

console.log("Local only: ", localOnly);
var middleware = function (req, res, next) {
	req.setTimeout(10000);
	var ip = req.headers["x-forwarded-for"] || req.connection.remoteAddress;
	var localNetwork = true;
	const regex = /\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}/g;
	var found = ip.match(regex);
	if (ip.includes("::1")) {
		found = "localhost";
	} else if (found.length > 0) {
		found = found[0];
	}
	console.log("\n===Middleware===");
	console.log(
		"IP:     " +
			found +
			", connected to: " +
			serverWifiIP.address +
			"\\" +
			serverWifiIP.netmask
	);
	console.log("Time:   " + new Date(Date.now()).toString());
	console.log("Route:  " + req.method + ", " + req.originalUrl);
	console.log("local:  " + localNetwork);

	console.log("\nbody:   " + JSON.stringify(req.body || {}));
	console.log("query:  " + JSON.stringify(req.query || {}));
	console.log("params: " + JSON.stringify(req.params || {}));

	//console.log("token:" + req.cookies.token);
	if (
		localOnly &&
		!(found.toLowerCase() == "localhost" || found.toLowerCase() == "127.0.0.1")
	) {
		console.log("Localhost only!");
		res.sendStatus(401);
	} else if (!block || !localNetwork) {
		res.sendStatus(404);
	} else if (req.cookies) {
		try {
			console.log("Decoded!");
			const decoded = jwt.verify(req.cookies.token, process.env.TOKEN_SECRET);
			const token = jwt.sign(
				{ username: decoded.username },
				process.env.TOKEN_SECRET,
				{
					expiresIn: "24h",
				}
			);
			res.cookie("token", token);
			next();
		} catch {
			console.log("error decode");
			res.redirect("/login?url=" + encodeURIComponent(req.originalUrl));
		}
	} else {
		res.redirect("/login");
	}
	console.log("\n");
	//next();
};

app.get("/", middleware, (req, res) => {
	res.redirect("/locker");
});

app.get("/locker/:lockerNumb/give", middleware, (req, res) => {
	console.log(req.params.lockerNumb);
	var query =
		"select * from pupil where not EXISTS(select * from locker where owner_id=pupil.id) AND inschool=1 ORDER BY grade,classP,lastname,firstname ASC";
	db.all(query, function (err, rows) {
		//console.log(rows);
		res.render("lockerGive", {
			title: "Give locker " + req.params.lockerNumb,
			lockerNumb: req.params.lockerNumb,
			search: req.query.search,
			plan: req.query.plan,
			status: req.query.status,
			rows,
		});
	});
});
//add search
app.get("/inventory/:inventoryId/give", middleware, (req, res) => {
	var query = "";
	var cols = [];
	var q = [];
	var search = (req.query.search || "").toLowerCase();
	if (req.query.table) {
		var dbCheck = false;
		if (req.query.table == 0) {
			query =
				"select id as owner_id,firstname as Firstname,lastname as Lastname,grade||classP as Klass from pupil" +
				" where ((instr(LOWER(Firstname), ?) > 0 OR instr(LOWER(Lastname), ?) > 0 " +
				" OR (instr(?, LOWER(Firstname)) > 0 AND instr(?, LOWER(Lastname)) > 0) OR ?='' " +
				" OR (Klass)=?)) AND inschool=1 order by Klass";
			q = [search, search, search, search, search, search];
			cols = ["Firstname", "Lastname", "Klass"];
			dbCheck = true;
		} else if (req.query.table == 3) {
			query =
				"select id as owner_id,name as Name,type as Type from place order by Name";
			q = [];
			cols = ["Name", "Type"];
			dbCheck = true;
		} else if (req.query.table == 4) {
		}
		if (dbCheck)
			db.all(query, q, function (err, rows) {
				if (err) console.log(err.message);
				res.render("inventoryGive", {
					title: "Give Inventory " + req.params.inventoryId,
					search: req.query.search || "",
					table: req.query.table,
					cols,
					rows,
				});
			});
		else res.sendStatus(404);
	} else {
		res.sendStatus(404);
	}
});
app.post("/inventory/:inventoryId/give", middleware, (req, res) => {
	var query = "";
	var search = (req.query.search || "").toLowerCase();
	if (req.body.table && req.body.owner_id) {
		db.get(
			"select inventory.id,inventory.owner_id,inventory.owner_table,inventory.model,inventory.brand,inventory.serial," +
				"\tCASE" +
				"\twhen inventory.owner_table=0 then (pupil.firstname||' '||pupil.lastname||', '||pupil.grade||pupil.classP)" +
				"\twhen inventory.owner_table=3 then place.name" +
				"\tEND 'historyPreOwner',owner_id from inventory" +
				"\tleft join pupil on owner_table=0 AND inventory.owner_id=pupil.id" +
				"\tleft join place on owner_table=3 AND inventory.owner_id=place.id" +
				"\twhere inventory.id=?",
			[req.params.inventoryId],
			function (err, preOwner) {
				if (!err && preOwner.owner_id) {
					sqlInsertHistory({
						owner_table: preOwner.owner_table,
						id: preOwner.owner_id,
						type: "inventory",
						comment:
							preOwner.serial +
							", " +
							preOwner.type +
							", " +
							preOwner.model +
							"->",
					});
					sqlInsertHistory({
						owner_table: 2,
						id: preOwner.id,
						type: "comment",
						comment: preOwner.historyPreOwner + "->",
					});
				}
				db.run(
					"UPDATE inventory SET owner_table=?,owner_id=? where id=?",
					[req.body.table, req.body.owner_id, req.params.inventoryId],
					function (err, rows) {
						if (err) {
							console.log(err.message);
						} else {
							db.get(
								"select * from inventory where id=?",
								[req.params.inventoryId],
								function (err, inventory) {
									if (err) {
									} else {
										sqlInsertHistory({
											owner_table: req.body.table,
											id: req.body.owner_id,
											type: "inventory",
											comment:
												"->" +
												inventory.serial +
												", " +
												inventory.type +
												", " +
												inventory.model,
										});
										sqlInsertHistory({
											owner_table: 2,
											id: inventory.id,
											type: "comment",
											comment: "->" + req.body.historyOwner,
										});
									}
									res.redirect("/inventory/" + req.params.inventoryId);
								}
							);
						}
					}
				);
			}
		);
	} else {
		res.sendStatus(404);
	}
});

app.get("/pupil/add", middleware, (req, res) => {
	res.render("pupiladd", {
		title: "Lägg till elev",
	});
});
app.get("/place/add", middleware, (req, res) => {
	res.render("placeadd", {
		title: "Lägg till Plats",
	});
});
app.get("/inventory/add", middleware, (req, res) => {
	db.all("select name from type order by name", function (err, rows) {
		res.render("inventoryadd", {
			title: "Lägg till inventarie",
			rows,
		});
	});
});
app.post("/inventory/add", middleware, (req, res) => {
	if (!req.body && !(req.body.serial && req.body.type)) {
		res.sendStatus(404);
	} else {
		req.body.serial = req.body.serial.trim();
		if (req.body.serial == "") {
			req.body.serial = null;
		}
		db.run(
			"insert into type (name) values (?)",
			[req.body.type.toUpperCase()],
			function (err) {}
		);
		db.run(
			"insert into inventory(serial,type,brand,model,comment) VALUES (?,?,?,?,?);",
			//"insert into history(owner_table,owner_id,type,comment,date) VALUES (?,?,?,?,?)",
			[
				req.body.serial,
				req.body.type.toUpperCase(),
				req.body.brand,
				req.body.model,
				req.body.comment,
			],
			function (err) {
				if (err) {
					console.log(err.message);
					db.all("select name from type", function (err, rows) {
						res.render("inventoryadd", {
							title: "Lägg till inventarie, Kunde inte lägga till inventarie!",
							rows,
						});
					});
				} else {
					sqlInsertHistory({
						owner_table: -1,
						id: -1,
						type: "added",
						comment:
							req.body.type +
							", " +
							req.body.brand +
							" " +
							req.body.model +
							", " +
							req.body.serial,
					});
					res.redirect("/inventory");
				}
			}
		);
	}
});
app.post("/pupil/add", middleware, (req, res) => {
	if (!req.body) {
		res.sendStatus(404);
	} else if (
		req.body.firstname &&
		req.body.lastname &&
		req.body.grade &&
		req.body.classP &&
		req.body.year
	) {
		db.run(
			"insert into pupil(firstname,lastname,grade,classP,year) VALUES (?,?,?,?,?);",
			//"insert into history(owner_table,owner_id,type,comment,date) VALUES (?,?,?,?,?)",
			[
				req.body.firstname,
				req.body.lastname,
				req.body.grade,
				req.body.classP,
				req.body.year,
			],
			function (err) {
				if (err) {
					console.log(err.message);
				}
				sqlInsertHistory({
					owner_table: -1,
					id: -1,
					type: "added",
					comment:
						req.body.firstname +
						" " +
						req.body.lastname +
						"," +
						req.body.grade +
						req.body.classP,
				});
				res.redirect("/pupil");
			}
		);
	} else {
		res.sendStatus(404);
	}
});
app.post("/place/add", middleware, (req, res) => {
	if (!req.body) {
		res.sendStatus(404);
	} else if (req.body.name && req.body.type) {
		db.run(
			"insert into place(name,type) VALUES (?,?);",
			//"insert into history(owner_table,owner_id,type,comment,date) VALUES (?,?,?,?,?)",
			[req.body.name, req.body.type],
			function (err) {
				if (err) {
					console.log(err.message);
				}
				sqlInsertHistory({
					owner_table: -1,
					id: -1,
					type: "added",
					comment: "Plats: " + req.body.name + "," + req.body.type,
				});
				res.redirect("/place");
			}
		);
	} else {
		res.sendStatus(404);
	}
});
app.post("/pupil/graduate", middleware, (req, res) => {
	if (req.body.id) {
		db.run(
			"UPDATE pupil set inschool=0 where id=?",
			[req.body.id],
			function (err) {
				if (err) console.log(err);
				res.sendStatus(200);
				db.get(
					"select * from pupil where id=?",
					[req.body.id],
					function (err, pupil) {
						sqlInsertHistory({
							owner_table: -1,
							id: -1,
							type: "graduated",
							comment:
								pupil.firstname +
								" " +
								pupil.lastname +
								"," +
								pupil.grade +
								pupil.classP,
						});
					}
				);
			}
		);
	} else {
		res.sendStatus(404);
	}
});
app.post("/pupil/enroll", middleware, (req, res) => {
	if (req.body.id) {
		db.run(
			"UPDATE pupil set inschool=1 where id=?",
			[req.body.id],
			function (err) {
				if (err) console.log(err);
				res.sendStatus(200);
				db.get(
					"select * from pupil where id=?",
					[req.body.id],
					function (err, pupil) {
						sqlInsertHistory({
							owner_table: -1,
							id: -1,
							type: "enrolled",
							comment:
								pupil.firstname +
								" " +
								pupil.lastname +
								"," +
								pupil.grade +
								pupil.classP,
						});
					}
				);
			}
		);
	} else {
		res.sendStatus(404);
	}
});
//TODO lägg till hårdvara
app.post("/checkin", middleware, (req, res) => {
	if (!req.body) {
		res.sendStatus(404);
	} else if (req.body.table == "locker") {
		db.run(
			"UPDATE locker set owner_id=null,status=1 where locker.number=?",
			[req.body.idItem],
			function (err) {
				if (err) {
					console.log(err.message);
				} else {
					db.get(
						"select id from locker where number=?",
						[req.body.idItem],
						function (err, lockerId) {
							if (lockerId && lockerId.id) {
								//locker
								sqlInsertHistory({
									owner_table: 1,
									id: lockerId.id,
									type: "comment",
									comment:
										req.body.firstname +
										" " +
										req.body.lastname +
										"," +
										req.body.klass +
										"->",
								});

								//pupil
								sqlInsertHistory({
									owner_table: 0,
									id: req.body.owner_id,
									type: "locker",
									comment: req.body.idItem + "->",
								});
							}
						}
					);
				}
				res.sendStatus(200);
			}
		);
	} else if (req.body.table == "inventory") {
	} else {
		res.sendStatus(404);
	}
});
//TODO lägg till hårdvara
app.post("/checkout", middleware, (req, res) => {
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
				db.get(
					"select id from locker where number=?",
					[req.body.idItem],
					function (err, lockerId) {
						if (lockerId && lockerId.id) {
							//locker
							sqlInsertHistory({
								owner_table: 1,
								id: lockerId.id,
								type: "comment",
								comment:
									"->" +
									req.body.firstname +
									" " +
									req.body.lastname +
									"," +
									req.body.klass,
							});
							//pupil
							sqlInsertHistory({
								owner_table: 0,
								id: req.body.idPupil,
								type: "locker",
								comment: "->" + req.body.idItem,
							});
						}
					}
				);
				res.redirect(
					"/locker?search=" +
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
app.get("/locker/:lockerNumb", middleware, (req, res) => {
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
					"select type,comment,DATETIME(round(date/1000),'unixepoch','localtime') as date from history where owner_table=1 and owner_id=? ORDER by date DESC",
					[row.id],
					function (err, history) {
						db.all(
							"select type,comment,DATETIME(round(date/1000),'unixepoch','localtime') as date from history where owner_table=0 and owner_id=? ORDER by date DESC",
							[row.owner_id],
							function (err, historyPupil) {
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

								statusSelected[row.status] = true;

								res.render("lockerinfo", {
									title: "Skåp: " + req.params.lockerNumb,
									lockerNumb: req.params.lockerNumb,
									row,
									statusSelected,
									history,
									historyPupil,
									historyPost: req.originalUrl,
									statusInventoryText,
									statusInventoryColor,
									statusLockerColor,
									statusLockerText,
								});
							}
						);
					}
				);
			}
		}
	);
});
app.get("/inventory/:inventoryId", middleware, (req, res) => {
	db.get(
		"select * from inventory where id=?",
		[req.params.inventoryId],
		function (err, row) {
			if (err || !row) {
				console.log(err);
				res.sendStatus(404);
			} else {
				db.all(
					"select type,comment,DATETIME(round(date/1000),'unixepoch','localtime') as date from history where owner_table=2 and owner_id=? ORDER by date DESC",
					[row.id],
					function (err, history) {
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
						};

						statusSelected[row.status] = true;
						if (owner_table_Enum[row.owner_table] == "pupil") {
							db.get(
								`select * from pupil where id=?`,
								[row.owner_id],
								function (err, pupil) {
									res.render("inventoryInfo", {
										title: `Inventarie: ${row.type}, ${row.brand} ${row.model}`,
										row,
										statusSelected,
										history,
										historyPost: req.originalUrl,
										owner: `${pupil.firstname} ${pupil.lastname},${pupil.grade}${pupil.classP}`,
										link: `/pupil/${pupil.id}`,
										statusInventoryText,
										statusInventoryColor,
									});
								}
							);
						} else if (owner_table_Enum[row.owner_table] == "place") {
							db.get(
								`select * from place where id=?`,
								[row.owner_id],
								function (err, place) {
									res.render("inventoryInfo", {
										title: `Inventarie: ${row.type}, ${row.brand} ${row.model}`,
										row,
										statusSelected,
										history,
										historyPost: req.originalUrl,
										owner: `${place.name}`,
										link: `/place/${place.id}`,
										statusInventoryText,
										statusInventoryColor,
									});
								}
							);
						} else {
							res.render("inventoryInfo", {
								title: `Inventarie: ${row.type}, ${row.brand} ${row.model}`,
								row,
								statusSelected,
								history,
								historyPost: req.originalUrl,
								statusInventoryText,
								statusInventoryColor,
							});
						}
					}
				);
			}
		}
	);
});
app.get("/pupil/:pupilId", middleware, (req, res) => {
	db.get(
		"select pupil.id,firstname,lastname,grade,classP,locker.number,year,inschool from pupil left join locker on pupil.id=locker.owner_id where pupil.id=?",
		[req.params.pupilId],
		function (err, row) {
			if (err || !row) {
				console.log(err);
				res.sendStatus(404);
			} else {
				db.all(
					"select type,comment,DATETIME(round(date/1000),'unixepoch','localtime') as date from history where owner_table=0 and owner_id=? ORDER by date DESC",
					[row.id],
					function (err, history) {
						db.all(
							"select * from inventory where owner_id=? AND owner_table=?",
							[req.params.pupilId, 0],
							function (err, inventory) {
								if (history) {
									console.log("history true");
								} else {
									history = {};
								}
								//console.log(statusSelected);
								res.render("pupilInfo", {
									title: "Elev: " + row.firstname + " " + row.lastname,
									row,
									history,
									historyPost: req.originalUrl,
									inventory,
									statusInventoryText,
									statusInventoryColor,
								});
							}
						);
					}
				);
			}
		}
	);
});
app.get("/place/:placeid", middleware, (req, res) => {
	db.get(
		"select * from place where id=?",
		[req.params.placeid],
		function (err, row) {
			if (err || !row) {
				console.log(err);
				res.sendStatus(404);
			} else {
				db.all(
					"select type,comment,DATETIME(round(date/1000),'unixepoch','localtime') as date from history where owner_table=3 and owner_id=? ORDER by date DESC",
					[row.id],
					function (err, history) {
						db.all(
							"select * from inventory where owner_id=? AND owner_table=3",
							[req.params.placeid],
							function (err, inventory) {
								if (history) {
									console.log("history true");
								} else {
									history = {};
								}
								//console.log(statusSelected);
								res.render("placeinfo", {
									title: "Plats: " + row.name,
									row,
									history,
									historyPost: req.originalUrl,
									inventory,
									statusInventoryText,
									statusInventoryColor,
								});
							}
						);
					}
				);
			}
		}
	);
});
app.post("/locker/:lockerNumb", middleware, (req, res) => {
	if (req.body && req.body["keys"]) {
		db.run(
			"update locker set keys=?,status=? where number=?",
			[req.body["keys"], req.body["status"], req.params.lockerNumb],
			function (err) {
				if (err) {
					console.log(err);
					res.sendStatus(404);
				} else {
					res.redirect("/locker/" + req.params.lockerNumb);
				}
			}
		);
	} else if (req.body && req.body["comment"]) {
		db.get(
			"select id from locker where number=?",
			[req.params.lockerNumb],
			function (err, row) {
				if (err) {
					res.sendStatus(404);
					return;
				}

				sqlInsertHistory({
					owner_table: 1,
					id: row.id,
					type: "comment",
					comment: req.body["comment"],
					res: res,
					redirect: "/locker/" + req.params.lockerNumb,
				});
			}
		);
	} else {
		res.sendStatus(404);
	}
});
app.post("/inventory/:inventoryId", middleware, (req, res) => {
	if (req.body && req.body["comment"]) {
		sqlInsertHistory({
			owner_table: 2,
			id: req.params.inventoryId,
			type: "comment",
			comment: req.body["comment"],
			res: res,
			redirect: "/inventory/" + req.params.inventoryId,
		});
	} else if (req.body) {
		db.run(
			"update inventory set comment=?,status=? where id=?",
			[
				req.body["commentInventory"],
				req.body["status"],
				req.params.inventoryId,
			],
			function (err) {
				if (err) {
					console.log(err);
					res.sendStatus(404);
				} else {
					res.redirect("/inventory/" + req.params.inventoryId);
				}
			}
		);
	} else {
		res.sendStatus(404);
	}
});
app.post("/pupil/:pupilId", middleware, (req, res) => {
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
					res.redirect("/pupil/" + req.params.pupilId);
				}
			}
		);
	} else if (req.body && req.body["comment"]) {
		sqlInsertHistory({
			owner_table: 0,
			id: req.params.pupilId,
			type: "comment",
			comment: req.body["comment"],
			res: res,
			redirect: "/pupil/" + req.params.pupilId,
		});
	} else {
		res.sendStatus(404);
	}
});
app.post("/place/:placeid", middleware, (req, res) => {
	if (req.body && req.body["name"]) {
		db.run(
			"update place set name=?,type=? where id=?",
			[req.body["name"], req.body["type"], req.params.placeid],
			function (err) {
				if (err) {
					console.log(err);
					res.sendStatus(404);
				} else {
					res.redirect("/place/" + req.params.placeid);
				}
			}
		);
	} else if (req.body && req.body["comment"]) {
		sqlInsertHistory({
			owner_table: 3,
			id: req.params.placeid,
			type: "comment",
			comment: req.body["comment"],
			res: res,
			redirect: "/place/" + req.params.placeid,
		});
	} else {
		res.sendStatus(404);
	}
});
app.all("/pupil", middleware, (req, res) => {
	var search = "";
	if (req.body && req.body.search) {
		search = req.body.search.toLowerCase();
	}
	var inschool = 1;
	if (req.query.inschool == 0) {
		inschool = 0;
	}
	var query =
		"select " +
		" * " +
		" from pupil " +
		" where ((instr(LOWER(firstname), ?) > 0 OR instr(LOWER(lastname), ?) > 0 " +
		" OR (instr(?, LOWER(firstname)) > 0 AND instr(?, LOWER(lastname)) > 0) OR ?='' " +
		" OR (grade||classP)=?)) AND inschool=?" +
		" ORDER BY grade,classP,lastname,firstname ASC";
	db.all(
		query,
		[search, search, search, search, search, search, inschool],
		function (err, rows) {
			if (err) console.log(err.message);
			res.render("pupil", {
				title: "Elever",
				rows,
				search,
			});
		}
	);
});
app.all("/place", middleware, (req, res) => {
	var query = "select * from place order by name";
	db.all(query, function (err, rows) {
		if (err) console.log(err.message);
		res.render("place", {
			title: "Platser",
			rows,
		});
	});
});
//TODO computer->Inventory
app.get("/history", middleware, (req, res) => {
	var query =
		"select \n" +
		"\tCASE \n" +
		"\tWHEN history.owner_table=-1 then \n" +
		"\t\t'general' \n" +
		"\tWHEN history.owner_table=0 THEN\n" +
		"\t\t'pupil'\n" +
		"\tWHEN history.owner_table=1 THEN\n" +
		"\t\t'locker'\n" +
		"\tWHEN history.owner_table=2 THEN\n" +
		"\t\t'inventory'\n" +
		"\tWHEN history.owner_table=3 THEN\n" +
		"\t\t'place'\n" +
		"\tEND owner,\n" +
		"\tCASE\n" +
		"\tWHEN history.owner_table=0 THEN\n" +
		"\t\t(firstname||' '||lastname||','||(grade||classP))\n" +
		"\tWHEN history.owner_table=1 THEN\n" +
		"\t\tlocker.number\n" +
		"\tWHEN history.owner_table=2 THEN\n" +
		"\t\tinventory.serial|inventory.id\n" +
		"\tWHEN history.owner_table=3 THEN\n" +
		"\t\tplace.name\n" +
		"\tEND res,\n" +
		"\tCASE\n" +
		"\tWHEN history.owner_table=0 THEN\n" +
		"\t\t'/pupil/'||pupil.id\n" +
		"\tWHEN history.owner_table=1 THEN\n" +
		"\t\t'/locker/'||locker.number\n" +
		"\tWHEN history.owner_table=2 THEN\n" +
		"\t\t'/inventory/'||inventory.id\n" +
		"\tWHEN history.owner_table=3 THEN\n" +
		"\t\t'/place/'||place.id\n" +
		"\tEND link,\n" +
		"\thistory.type,history.comment,DATETIME(round(date/1000),'unixepoch','localtime') as date\n" +
		"\tfrom history\n" +
		"\tleft JOIN pupil on owner='pupil' AND history.owner_id=pupil.id\n" +
		"\tleft JOIN locker on owner='locker' AND history.owner_id=locker.id\n" +
		"\tleft JOIN inventory on owner='inventory' AND history.owner_id=inventory.id" +
		"\tleft JOIN place on owner='place' AND history.owner_id=place.id" +
		"\tOrder by history.date DESC";
	db.all(query, function (err, rows) {
		if (err) console.log(err.message);
		res.render("history", {
			title: "Historia",
			rows,
		});
	});
});

app.all("/locker", middleware, (req, res) => {
	var planValue = req.body.plan;
	var statusValue = req.body.status;
	var search = "";
	if (req.body && req.body.search) {
		search = req.body.search.toLowerCase();
	}

	var plan = "";
	var status = "";
	if (Object.keys(req.query).length) {
		search = req.query.search;
		planValue = req.query.plan;
		statusValue = req.query.status;
	}

	if (planValue && planValue != "undefined" && planValue != -1) {
		plan = " and floor=" + planValue;
	} else {
		planValue = -1;
	}

	if (statusValue && statusValue != "undefined" && statusValue != -1) {
		status = " and status=" + statusValue;
	} else {
		statusValue = -1;
	}
	var query =
		"select " +
		" locker.id,locker.keys,locker.floor,locker.status,locker.number,locker.owner_id,grade,pupil.year,classP,firstname,lastname,inschool" +
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
			res.render("locker", {
				title: "Skåp",
				rows,
				search,
				planValue,
				statusValue,
				statusLockerText,
				statusLockerColor,
			});
		}
	);
});
app.all("/inventory", middleware, (req, res) => {
	var search = "";
	if (req.body && req.body.search) {
		search = req.body.search.toLowerCase();
	}
	var query =
		"select " +
		"\tCase " +
		"\tWHEN inventory.owner_table=0 THEN\n" +
		"\t\t'pupil'\n" +
		"\tWHEN inventory.owner_table=3 THEN\n" +
		"\t\t'place'\n" +
		"\tEND owner,\n" +
		"\tCASE\n" +
		"\tWHEN inventory.owner_table=0 THEN\n" +
		"\t\t(firstname||' '||lastname||','||(grade||classP))\n" +
		"\tWHEN inventory.owner_table=3 THEN\n" +
		"\t\tname\n" +
		"\tEND res,\n" +
		"\tCASE\n" +
		"\tWHEN inventory.owner_table=0 THEN\n" +
		"\t\t'/pupil/'||pupil.id\n" +
		"\tWHEN inventory.owner_table=3 THEN\n" +
		"\t\t'/place/'||place.id\n" +
		"\tEND link,\n" +
		"\tinventory.type,inventory.brand,inventory.model,inventory.status,inventory.serial,inventory.id" +
		" from inventory " +
		"\tleft JOIN pupil on owner='pupil' AND inventory.owner_id=pupil.id\n" +
		"\tleft JOIN place on owner='place' AND inventory.owner_id=place.id\n" +
		" where (instr(LOWER(inventory.serial), ?) > 0 OR instr(LOWER(inventory.model), ?) > 0 " +
		" OR instr(LOWER(inventory.type),?) > 0) " +
		" OR instr(LOWER(res),?) > 0";
	db.all(query, [search, search, search, search], function (err, rows) {
		if (err) console.log(err.message);
		res.render("inventory", {
			title: "Inventory",
			rows,
			search,
			statusInventoryText,
			statusInventoryColor,
		});
	});
});
app.get("/lockerlayout", middleware, (req, res) => {
	db.all("select * from locker", function (err, rows) {
		if (err) console.log(err.message);
		if (req.query.dataonly) {
			res.json(rows);
			res.end();
			console.log("lockerlayout get");
		} else {
			var tab = 1;
			if (req.query.tab) {
				tab = req.query.tab;
			}
			res.render("lockerlayout", {
				title: `Skåp layout: ${tab * 100} Plan`,
				rows,
				statusLockerColor,
				tab,
			});
		}
	});
});

app.get("/login", (req, res) => {
	res.cookie("token", "");
	res.render("login");
	//res.sendFile(path.join(__dirname + "/login.html"));
});
app.post("/auth", (req, res) => {
	if (req.body) {
		db.get(
			"select * from users where username=?",
			[req.body.username],
			(err, row) => {
				if (err) {
					console.error(err.message);
					res.sendStatus(404);
				} else if (!row) {
					res.send("Username does not exist!");
				} else {
					console.log("Logging in: " + row.username);
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
										expiresIn: "24h",
									}
								);
								console.log("token: " + token);
								res.cookie("token", token);
								res.redirect("/locker");
							} else {
								res.send("Wrong Password!");
							}
							//res.end();
						}
					);
				}
			}
		);
	}
});

app.listen(port, () => {
	console.log(`Server started: http://localhost:${port}`);
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
const statusInventoryColor = {
	0: "LIMEGREEN",
	1: "RED",
	2: "YELLOW",
	3: "BLUE",
	4: "PURPLE",
};
const statusInventoryText = {
	0: "OK",
	1: "SÖNDER",
	2: "REPARERAS",
	3: "UTLÅNAD",
	4: "VÄNTAR PÅ RESERVDEL",
};
const owner_table_Enum = {
	"-1": "general",
	0: "pupil",
	1: "locker",
	2: "inventory",
	3: "place",
	4: "teacher",
};
function sqlInsertHistory({
	owner_table,
	id,
	type,
	comment,
	res,
	redirect,
	date = new Date(),
}) {
	console.log("\nHistory insert: ");
	console.log({
		owner: owner_table_Enum[owner_table],
		id,
		type,
		comment,
		redirect,
		dateString: date.toString(),
	});
	if (comment.length < 1000) {
		db.run(
			"insert into history(owner_table,owner_id,type,comment,date) VALUES (?,?,?,?,?)",
			[owner_table, id, type, comment, date],
			function (err) {
				if (res) {
					if (err) {
						res.sendStatus(404);
					} else {
						res.redirect(redirect);
					}
				}
			}
		);
	} else if (res) {
		res.sendStatus(404);
	}
}
