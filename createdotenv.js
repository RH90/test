const fs = require("fs");

var string =
	"TOKEN_SECRET=" + require("crypto").randomBytes(64).toString("hex");

fs.writeFile(".env", string, function (err) {
	if (err) throw err;
	console.log("File is created successfully.");
});
