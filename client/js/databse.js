var mysql = require('mysql');

var con = mysql.createConnection({
    host: "cheshire.cse.buffalo.edu",
    user: "plrobert",
    password: "50227586"
});

con.connect(function(err) {
    if (err) throw err;
    console.log("Connected!");
});