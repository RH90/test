window.addEventListener("load", (event) => {
	const div = document.getElementById("hideAll");
	if (div) div.style.display = "block";

	var input = document.querySelectorAll("input,select,textarea");
	for (let k = 0; k < input.length; k++) {
		const element = input[k];
		element.onchange = function () {
			element.style.backgroundColor = "#E0ECFF";
		};
	}
});
function downloadCSV(csv, filename) {
	var csvFile;
	var downloadLink;

	// CSV file
	csvFile = new Blob([csv], { type: "text/csv" });
	// Download link
	downloadLink = document.createElement("a");
	// File name
	downloadLink.download = filename;
	// Create a link to the file
	downloadLink.href = window.URL.createObjectURL(csvFile);
	// Hide download link
	downloadLink.style.display = "none";
	// Add the link to DOM
	document.body.appendChild(downloadLink);
	// Click download link
	downloadLink.click();
}
function exportTableToCSV(filename) {
	var csv = [];
	var rows = document.querySelectorAll(".sortable tr");

	for (var i = 0; i < rows.length; i++) {
		var row = [],
			cols = rows[i].querySelectorAll("td, th");

		for (var j = 0; j < cols.length; j++)
			row.push('"' + cols[j].innerText + '"');

		csv.push(row.join(","));
	}

	// Download CSV file
	downloadCSV(csv.join("\n"), filename);
}

function lockerlayout() {
	fetch("/lockerlayout?dataonly=1", {
		method: "GET",
		headers: {
			"Content-Type": "application/json",
		},
	}).then((res) => {
		res.json().then((output) => {
			const rows = output.rows;
			var cells = document.querySelectorAll(".locker-cell");
			for (let i = 0; i < cells.length; i++) {
				var locker = rows.filter((rows) => {
					return rows.number == cells[i].innerText;
				})[0];
				cells[i].style.background = output.statusLocker[locker.status].color;

				if (locker.keys > 2) {
					cells[i].style.color = "blue";
				} else if (locker.keys > 1) {
					cells[i].style.color = "black";
				} else {
					cells[i].style.color = "red";
				}
			}
		});
	});
}
function geUt(locker, pupil) {
	console.log("locker: " + locker + ", pupil: " + pupil);
}

function openNav() {
	const display = document.getElementById("mySidenav").style.display;
	if (display == "block")
		document.getElementById("mySidenav").style.display = "none";
	else document.getElementById("mySidenav").style.display = "block";
}
function closeNav() {
	document.getElementById("mySidenav").style.display = "none";
}
function copytable(el) {
	var urlField = document.querySelector("." + el);
	if (urlField) {
		var range = document.createRange();
		range.selectNode(urlField);
		window.getSelection().addRange(range);
		document.execCommand("copy");
	}
}

function clearLocker(owner_id, klass, firstname, lastname, numb, search) {
	if (
		confirm(
			"Ta bort " +
				firstname +
				" " +
				lastname +
				" från skåp " +
				numb +
				"? id:" +
				owner_id
		)
	) {
		console.log("numb");
		let data = {
			firstname: firstname,
			lastname: lastname,
			klass: klass,
			owner_id: owner_id,
			idItem: numb,
			table: "locker",
		};
		fetch("/checkin", {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
			},
			body: JSON.stringify(data),
		}).then((res) => {
			console.log("Request complete! response:", res);
			var input = document.getElementById("inputSearch");
			if (input) {
				input.value = search;
				var b = document.getElementById("buttonSearch");
				b.click();
			} else {
				location.reload();
			}
		});
	}
}
function graduate(id) {
	if (confirm("Ta bort Elev?")) {
		let data = {
			id: id,
		};
		fetch("/pupil/graduate", {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
			},
			body: JSON.stringify(data),
		}).then((res) => {
			window.location.href = "/pupil";
		});
	}
}
function enroll(id) {
	if (confirm("Ta med Elev?")) {
		let data = {
			id: id,
		};
		fetch("/pupil/enroll", {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
			},
			body: JSON.stringify(data),
		}).then((res) => {
			window.location.href = "/pupil";
		});
	}
}

function hire(id) {
	if (confirm("Ta med Personal?")) {
		let data = {
			id: id,
		};
		fetch("/staff/hire", {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
			},
			body: JSON.stringify(data),
		}).then((res) => {
			window.location.href = "/staff";
		});
	}
}
function quit(id) {
	if (confirm("Ta bort Personal?")) {
		let data = {
			id: id,
		};
		fetch("/staff/quit", {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
			},
			body: JSON.stringify(data),
		}).then((res) => {
			window.location.href = "/staff";
		});
	}
}

document.addEventListener("click", function (evnt) {
	// console.log(evnt.target);
	if (evnt.target.id != "sideNavButton") {
		closeNav();
	}
});
