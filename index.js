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
var localOnly = false;

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
		var res = null;
		var text = "";
		if (results["Wi-Fi"] != undefined) {
			res = results["Wi-Fi"][0];
			text = "Wi-Fi";
		} else if (results["Ethernet"] != undefined) {
			res = results["Ethernet"][0];
			text = "Ethernet";
		}
		if (res == null && serverWifiIP != "") {
			console.log("Current local ip: No wifi/ethernet connection");
		} else if (res.address != serverWifiIP.address) {
			serverWifiIP = res;
			block = new Netmask(serverWifiIP.address + "/" + serverWifiIP.netmask);
			console.log(
				text +
					": Current local ip: http://" +
					serverWifiIP.address +
					`:${port}, mask: ` +
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
	} else if (found && found.length > 0) {
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
	var search = (req.query.search || "").toLowerCase();
	var query = `select * from pupil 
			where not EXISTS(select * from locker where owner_id=pupil.id) 
				AND inschool=1 
				AND ((instr(LOWER(firstname), ?) > 0 OR instr(LOWER(lastname), ?) > 0 
					OR (instr(?, LOWER(firstname)) > 0 AND instr(?, LOWER(lastname)) > 0) OR ?='' 
					OR (grade||classP)=?))
			ORDER BY grade,classP,lastname,firstname ASC`;
	db.all(
		query,
		[search, search, search, search, search, search],
		function (err, rows) {
			//console.log(rows);
			res.render("lockerGive", {
				title: "Give locker " + req.params.lockerNumb,
				lockerNumb: req.params.lockerNumb,
				search,
				plan: req.query.plan,
				status: req.query.status,
				rows,
			});
		}
	);
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
			query = `
			SELECT 
				id as owner_id,firstname as Firstname,lastname as Lastname,grade||classP as Klass from pupil
				where ((instr(LOWER(Firstname), ?) > 0 OR instr(LOWER(Lastname), ?) > 0 
				OR (instr(?, LOWER(Firstname)) > 0 AND instr(?, LOWER(Lastname)) > 0) OR ?='' 
				OR (Klass)=?)) AND inschool=1 order by Klass`;
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
			query = `
			SELECT firstname,lastname,id as owner_id from staff order by firstname,lastname`;
			q = [];
			cols = ["firstname", "lastname"];
			dbCheck = true;
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
	if (req.body.table && req.body.owner_id) {
		db.get(
			`
			SELECT 
				inventory.id,inventory.owner_id,inventory.owner_table,inventory.model,inventory.brand,inventory.serial,inventory.type,	
				CASE	
					when inventory.owner_table=0 then (pupil.firstname||' '||pupil.lastname||', '||pupil.grade||pupil.classP)	
					when inventory.owner_table=3 then place.name	
					when inventory.owner_table=4 then (staff.firstname||' '||staff.lastname||', Personal')	
				END 'historyPreOwner',owner_id from inventory	
				left join pupil on owner_table=0 AND inventory.owner_id=pupil.id	
				left join place on owner_table=3 AND inventory.owner_id=place.id
				left join staff on owner_table=4 AND inventory.owner_id=staff.id		
				where inventory.id=?`,
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
app.get("/staff/add", middleware, (req, res) => {
	res.render("staffadd", {
		title: "Lägg till personal",
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
			statusInventory,
		});
	});
});
//TODO lägg till tag
app.post("/inventory/add", middleware, (req, res) => {
	var { serial, type, brand, model, status, comment, tag } = req.body;
	if (!req.body && !(serial && type)) {
		res.sendStatus(404);
	} else {
		serial = serial.trim();
		if (serial == "") {
			serial = null;
		}
		db.run(
			"insert into type (name) values (?)",
			[type.toUpperCase()],
			function (err) {}
		);
		db.run(
			"insert into inventory(serial,type,brand,model,status,comment,tag) VALUES (?,?,?,?,?,?,?);",
			//"insert into history(owner_table,owner_id,type,comment,date) VALUES (?,?,?,?,?)",
			[
				serial.toUpperCase(),
				type.toUpperCase(),
				brand.toUpperCase(),
				model.toUpperCase(),
				status,
				comment,
				tag,
			],
			function (err) {
				if (err) {
					console.log(err.message);
					// db.all("select name from type", function (err, rows) {
					// 	res.render("inventoryadd", {
					// 		title: "Lägg till inventarie, Kunde inte lägga till inventarie!",
					// 		rows,
					// 	});
					// });
					res.send("Serial exists");
				} else {
					sqlInsertHistory({
						owner_table: -1,
						id: -1,
						type: "added",
						comment: type + ", " + brand + " " + model + ", " + serial,
					});
					db.get(
						"SELECT id from inventory order by ROWID DESC limit 1",
						function f(err, row) {
							if (row) {
								res.redirect("/inventory/" + row.id);
							} else res.redirect("/inventory");
						}
					);
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
app.post("/staff/add", middleware, (req, res) => {
	const { firstname, lastname, job, phone, section, comment } = req.body;
	if (!req.body) {
		res.sendStatus(404);
	} else if (firstname && lastname) {
		db.run(
			"insert into staff(firstname,lastname,job,phone,section,comment) VALUES (?,?,?,?,?,?);",
			//"insert into history(owner_table,owner_id,type,comment,date) VALUES (?,?,?,?,?)",
			[
				firstname,
				lastname,
				job || "",
				phone || "",
				section || "",
				comment || "",
			],
			function (err) {
				if (err) {
					console.log(err.message);
				}
				sqlInsertHistory({
					owner_table: -1,
					id: -1,
					type: "added",
					comment: firstname + " " + lastname + ", Personal",
				});
				res.redirect("/staff");
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
							owner_table: 0,
							id: req.body.id,
							type: "comment",
							comment: "Graduated",
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
							owner_table: 0,
							id: req.body.id,
							type: "comment",
							comment: "Enrolled",
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
				res.redirect("/locker?search=" + req.query.numb);
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
									statusInventory,
									statusLocker,
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
										statusInventory,
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
										statusInventory,
									});
								}
							);
						} else if (owner_table_Enum[row.owner_table] == "staff") {
							db.get(
								`select * from staff where id=?`,
								[row.owner_id],
								function (err, staff) {
									res.render("inventoryInfo", {
										title: `Inventarie: ${row.type}, ${row.brand} ${row.model}`,
										row,
										statusSelected,
										history,
										historyPost: req.originalUrl,
										owner: `${staff.firstname} ${staff.lastname}, Personal`,
										link: `/staff/${staff.id}`,
										statusInventory,
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
								statusInventory,
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
		"select pupil.comment,pupil.id,firstname,lastname,grade,classP,locker.number,year,inschool from pupil left join locker on pupil.id=locker.owner_id where pupil.id=?",
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
									statusInventory,
								});
							}
						);
					}
				);
			}
		}
	);
});
app.get("/staff/:staffId", middleware, (req, res) => {
	const id = req.params.staffId;
	db.get("select * from staff where id=?", [id], function (err, row) {
		if (err || !row) {
			console.log(err);
			res.sendStatus(404);
		} else {
			db.all(
				"select type,comment,DATETIME(round(date/1000),'unixepoch','localtime') as date from history where owner_table=4 and owner_id=? ORDER by date DESC",
				[row.id],
				function (err, history) {
					db.all(
						"select * from inventory where owner_id=? AND owner_table=4",
						[id],
						function (err, inventory) {
							if (history) {
								console.log("history true");
							} else {
								history = {};
							}
							//console.log(statusSelected);
							res.render("staffInfo", {
								title: "Staff: " + row.firstname + " " + row.lastname,
								row,
								history,
								historyPost: req.originalUrl,
								inventory,
								statusInventory,
							});
						}
					);
				}
			);
		}
	});
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
									statusInventory,
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
					type: req.body["type"],
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
	var {
		brand,
		model,
		commentInventory,
		status,
		count,
		tag,
		type,
		comment,
	} = req.body;
	if (req.body && comment) {
		sqlInsertHistory({
			owner_table: 2,
			id: req.params.inventoryId,
			type: type,
			comment: comment,
			res: res,
			redirect: "/inventory/" + req.params.inventoryId,
		});
	} else if (req.body) {
		db.run(
			"update inventory set brand=?,model=?,comment=?,status=?,count=?,tag=? where id=?",
			[
				brand,
				model,
				commentInventory,
				status,
				count,
				tag,
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
			"update pupil set firstname=?,lastname=?,classP=?,grade=?,comment=? where id=?",
			[
				req.body["firstname"],
				req.body["lastname"],
				req.body["classP"],
				req.body["grade"],
				req.body["commentPupil"],
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
		var d = null;
		if (req.body["date"]) {
			d = new Date(req.body["date"]);
		}

		sqlInsertHistory({
			owner_table: 0,
			id: req.params.pupilId,
			type: req.body["type"],
			comment: req.body["comment"],
			res: res,
			redirect: "/pupil/" + req.params.pupilId,
			date: d,
		});
	} else {
		res.sendStatus(404);
	}
});
app.post("/staff/:staffId", middleware, (req, res) => {
	const id = req.params.staffId;
	const {
		firstname,
		lastname,
		job,
		phone,
		section,
		commentStaff,
		type,
		comment,
	} = req.body;
	if (req.body && !comment) {
		db.run(
			"update staff set firstname=?,lastname=?,job=?,phone=?,section=?,comment=? where id=?",
			[firstname, lastname, job, phone, section, commentStaff, id],
			function (err) {
				if (err) {
					console.log(err);
					res.sendStatus(404);
				} else {
					res.redirect("/staff/" + id);
				}
			}
		);
	} else if (req.body && comment) {
		sqlInsertHistory({
			owner_table: 4,
			id: id,
			type: type,
			comment: comment,
			res: res,
			redirect: "/staff/" + id,
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
//TODO lägg till
app.all("/pupil", middleware, (req, res) => {
	var search = "";
	if (req.body && req.body.search) {
		search = req.body.search.toLowerCase().trim();
	}
	var inschool = 1;
	var nolocketStr = "";
	if (req.query.inschool == 0) {
		inschool = 0;
	}
	if (req.query.nolocker == 1) {
		nolocketStr = " AND locker.owner_id is NULL ";
	}
	var query = `
		select *, group_concat(statusx||': '||type||serialx,x'0a') as inv
			FROM
			(
			select
				CASE
				WHEN serial is null THEN
				''
				ELSE (', '||serial)
				END serialx,
				CASE 
				WHEN inventory.status=0
				THEN '${statusInventory[0].text}'
				WHEN inventory.status=1
				THEN '${statusInventory[1].text}'
				WHEN inventory.status=2
				THEN '${statusInventory[2].text}'
				WHEN inventory.status=3
				THEN '${statusInventory[3].text}'
				WHEN inventory.status=4
				THEN '${statusInventory[4].text}'
				WHEN inventory.status=5
				THEN '${statusInventory[5].text}'
				WHEN inventory.status=6
				THEN '${statusInventory[6].text}'
				ELSE inventory.status
				END statusx,
				pupil.id,firstname,lastname,classP,grade,year,locker.owner_id,type from pupil  
				left join locker on locker.owner_id=pupil.id
				left join inventory on owner_table=0 and inventory.owner_id=pupil.id
				where 
						((((instr(LOWER(firstname), $search) > 0 OR instr(LOWER(lastname), $search) > 0) 
							OR (instr($search, LOWER(firstname)) > 0 AND instr($search, LOWER(lastname)) > 0)  
						OR (grade||classP)=$search)) 
						AND inschool=$inschool)
				${nolocketStr} 
			)
			GROUP BY id
			ORDER BY grade,classP,lastname,firstname ASC
			`;
	db.all(query, { $search: search, $inschool: inschool }, function (err, rows) {
		if (err) console.log(err.message);
		res.render("pupil", {
			title: "Elever",
			rows,
			search,
		});
	});
});
app.all("/staff", middleware, (req, res) => {
	var search = "";
	if (req.body && req.body.search) {
		search = req.body.search.toLowerCase();
	}
	var query = `
			SELECT
				* FROM staff
				WHERE 
					instr(LOWER(firstname), $search) > 0
				  	OR instr(LOWER(lastname), $search) > 0 
				ORDER BY lastname,firstname ASC`;
	db.all(query, { $search: search }, function (err, rows) {
		if (err) console.log(err.message);
		res.render("staff", {
			title: "Personal",
			rows,
			search,
		});
	});
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

app.get("/history", middleware, (req, res) => {
	var query = `
		SELECT 
			CASE 
				WHEN history.owner_table=-1 then 
					'general' 
				WHEN history.owner_table=0 THEN
					'pupil'
				WHEN history.owner_table=1 THEN
					'locker'
				WHEN history.owner_table=2 THEN
					'inventory'
				WHEN history.owner_table=3 THEN
					'place'
				WHEN history.owner_table=4 THEN
					'staff'
			END owner,
			CASE
				WHEN history.owner_table=0 THEN
					(pupil.firstname||' '||pupil.lastname||','||(pupil.grade||pupil.classP))
				WHEN history.owner_table=1 THEN
					locker.number
				WHEN history.owner_table=2 THEN
					(ifnull(inventory.serial,'null'))||','||inventory.type
				WHEN history.owner_table=3 THEN
					place.name
				WHEN history.owner_table=4 THEN
					(staff.firstname||' '||staff.lastname||','||(staff.job))
			END res,
			CASE
				WHEN history.owner_table=0 THEN
					'/pupil/'||pupil.id
				WHEN history.owner_table=1 THEN
					'/locker/'||locker.number
				WHEN history.owner_table=2 THEN
					'/inventory/'||inventory.id
				WHEN history.owner_table=3 THEN
					'/place/'||place.id
				WHEN history.owner_table=4 THEN
					'/staff/'||staff.id
			END link,
			history.type,history.comment,DATETIME(round(date/1000),'unixepoch','localtime') as date
			from history
			left JOIN pupil on owner='pupil' AND history.owner_id=pupil.id
			left JOIN staff on owner='staff' AND history.owner_id=staff.id
			left JOIN locker on owner='locker' AND history.owner_id=locker.id
			left JOIN inventory on owner='inventory' AND history.owner_id=inventory.id	
			left JOIN place on owner='place' AND history.owner_id=place.id
			Order by history.date DESC LIMIT 1000
	`;

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
	planValue = parseInt(planValue);
	statusValue = parseInt(statusValue);
	if (
		planValue &&
		Number.isInteger(planValue) &&
		planValue != "undefined" &&
		planValue != -1
	) {
		plan = " and floor=" + planValue;
	} else {
		planValue = -1;
	}

	if (
		statusValue > -1 &&
		Number.isInteger(statusValue) &&
		statusValue != "undefined"
	) {
		status = " and status=" + statusValue;
	} else {
		statusValue = -1;
	}
	var planSelected = {};
	var statusSelected = {};

	planSelected[planValue] = true;
	statusSelected[statusValue] = true;

	var query = `	
	SELECT *,substr(group_concat(Ldate||': '||Lhistory,x'0a'),0,150) as locker_history
		FROM
		(
			SELECT *,history.comment as Lhistory,DATE(round(history.date/1000),'unixepoch','localtime') as Ldate
			FROM
			(
				SELECT *,substr(group_concat(Pdate||': '||Phistory,x'0a'),0,150) as pupil_history
				FROM
				(
					SELECT locker.id as locker_id,keys,floor,locker.status,number,locker.owner_id as locker_owner_id,grade,pupil.year,classP,firstname,lastname,inschool,
					history.comment as Phistory,DATE(round(history.date/1000),'unixepoch','localtime') as Pdate
					from locker
					left join pupil on pupil.id = locker.owner_id
					left join history on pupil.id = history.owner_id AND history.owner_table=0
					ORDER by history.date DESC
				)
				GROUP by locker_id
			)
			left join history on locker_id = history.owner_id AND history.owner_table=1
			ORDER by history.date DESC
		)
		where (instr(LOWER(firstname), ?) > 0 OR instr(LOWER(lastname), ?) > 0 OR number=? OR (instr(?, LOWER(firstname)) > 0 
		AND instr(?, LOWER(lastname)) > 0) OR ?=''  OR (grade||classP)=?) 
		${plan} 
		${status}	
		GROUP by locker_id 
		ORDER BY grade,classP,lastname,firstname,status`;
	db.all(
		query,
		[search, search, search, search, search, search, search],
		function (err, rows) {
			if (err) {
				console.log(err);
			}
			res.render("locker", {
				title: "Skåp",
				rows,
				search,
				planValue,
				planSelected,
				statusValue,
				statusLocker,
				statusSelected,
			});
		}
	);
});
app.all("/inventory", middleware, (req, res) => {
	var search = "";
	if (req.body && req.body.search) {
		search = req.body.search.toLowerCase();
	}

	var statusSelected = {};
	var groupSelected = {};
	const status = parseInt(req.body.status);
	var statusString = "";
	if (Number.isInteger(status) && status != -1) {
		statusSelected[status] = true;
		statusString = " AND status=" + status;
	} else {
		statusSelected["-1"] = true;
	}
	groupSelected[req.body.group] = true;
	var query = `
	SELECT *,substr(group_concat(hDate||': '||hComment,x'0a'),0,150) as inventory_history from
	(SELECT 	
		Case 	
			WHEN inventory.owner_table=0 THEN 'pupil'
			WHEN inventory.owner_table=3 THEN 'place'
			WHEN inventory.owner_table=4 THEN 'staff'
		END owner,
		CASE
			WHEN inventory.owner_table=0 THEN (pupil.firstname||' '||pupil.lastname||','||(pupil.grade||pupil.classP))
			WHEN inventory.owner_table=3 THEN name
			WHEN inventory.owner_table=4 THEN (staff.firstname||' '||staff.lastname||', Personal')
		END res,
		CASE
			WHEN inventory.owner_table=0 THEN '/pupil/'||pupil.id
			WHEN inventory.owner_table=3 THEN '/place/'||place.id
			WHEN inventory.owner_table=4 THEN '/staff/'||staff.id
		END link,
		inventory.type,inventory.brand,inventory.model,inventory.status,inventory.serial,inventory.id,inventory.comment,inventory.tag
		,DATE(round(history.date/1000),'unixepoch','localtime') as hDate, history.comment as hComment,date,count
		from inventory 
		left JOIN pupil on owner='pupil' AND inventory.owner_id=pupil.id
		left JOIN place on owner='place' AND inventory.owner_id=place.id
		left JOIN staff on owner='staff' AND inventory.owner_id=staff.id
		left JOIN history on history.owner_id=inventory.id AND history.owner_table=2
		ORDER by date DESC)
	where ((instr(LOWER(serial), $search) > 0 
	OR instr(LOWER(comment),$search) > 0 
	OR instr(LOWER(model), $search) > 0 
	OR instr(LOWER(tag), $search) > 0 
	OR instr(LOWER(type), $search) > 0) OR instr(LOWER(res),$search) > 0)
	${statusString}
	GROUP by id
	ORDER by date desc
	`;
	if (req.body.group == 1) {
		query = `
		Select *,COUNT(*) as count from
		(${query})
		group by type,brand,model
		`;
	}

	db.all(query, { $search: search }, function (err, rows) {
		if (err) console.log(err.message);
		res.render("inventory", {
			title: "Inventory",
			rows,
			search,
			statusInventory,
			statusSelected,
			groupSelected,
			group: req.body.group,
		});
	});
});
app.get("/lockerlayout", middleware, (req, res) => {
	db.all("select * from locker", function (err, rows) {
		if (err) console.log(err.message);
		if (req.query.dataonly) {
			res.json({ rows, statusLocker });
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
				statusLocker,
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

const statusLocker = {
	0: { text: "ELEVE HAR SLÅPET", color: "LIMEGREEN" },
	1: { text: "LÅST AV SKOLAN", color: "PINK" },
	2: { text: "ELEV MED EGET LÅS", color: "YELLOW" },
	3: { text: "SKÅPET REPARERAS", color: "ORANGE" },
	4: { text: "LÅST M. MULTILÅS", color: "BLUE" },
	5: { text: "ELEV MED DED. SKÅP", color: "GRAY" },
	6: { text: "ANVÄNDS EJ", color: "LIGHTGRAY" },
	7: { text: "UTAN NYCKEL ELEVINNEHÅLL", color: "PURPLE" },
};
const statusInventory = {
	0: { text: "OK", color: "LIMEGREEN" },
	1: { text: "SÖNDER", color: "RED" },
	2: { text: "REPARERAS", color: "YELLOW" },
	3: { text: "UTLÅNAD", color: "BLUE" },
	4: { text: "VÄNTAR PÅ RESERVDEL", color: "PURPLE" },
	5: { text: "LÅST", color: "ORANGE" },
	6: { text: "KÖPT", color: "PINK" },
	7: { text: "SKROTAD/RENSAD", color: "GRAY" },
};

const owner_table_Enum = {
	"-1": "general",
	0: "pupil",
	1: "locker",
	2: "inventory",
	3: "place",
	4: "staff",
};
function sqlInsertHistory({
	owner_table,
	id,
	type,
	comment,
	res,
	redirect,
	date,
}) {
	if (!date) {
		date = new Date();
	}
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
