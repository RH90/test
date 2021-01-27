var sqlite3 = require("sqlite3").verbose();
const readline = require("readline");

function askQuestion(query) {
	const rl = readline.createInterface({
		input: process.stdin,
		output: process.stdout,
	});

	return new Promise((resolve) =>
		rl.question(query, (ans) => {
			rl.close();
			resolve(ans);
		})
	);
}

async function removeUser() {
	console.log("Remove user");
	var user = await askQuestion("Username: ");
	user = user.trim();
	var db = new sqlite3.Database("db/database.db");
	db.run("Delete from users where username=?", [user], function (err) {
		if (err) console.log(err);
		else console.log(`Done!\nUser:${user} Removed!`);
	});
}

removeUser();
