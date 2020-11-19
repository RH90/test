// setTimeout(function f() {
//   alert("test");
// }, 1000);

// var username = prompt("Enter Username", "Username");
// var password = prompt("Enter Password", "Password");

// const parseCookie = (str) =>
//   str
//     .split(";")
//     .map((v) => v.split("="))
//     .reduce((acc, v) => {
//       acc[decodeURIComponent(v[0].trim())] = decodeURIComponent(v[1].trim());
//       return acc;
//     }, {});
// console.log(parseCookie(document.cookie).token);
function openNav() {
  document.getElementById("mySidenav").style.display = "block";
}
function closeNav() {
  document.getElementById("mySidenav").style.display = "none";
}

function overlayOn() {
  document.getElementById("overlay").style.display = "block";
}

function overlayOff() {
  document.getElementById("overlay").style.display = "none";
}

document.addEventListener("click", function (evnt) {
  console.log(evnt.target);
  if (evnt.target.id != "sideNavButton") {
    closeNav();
  }
});
