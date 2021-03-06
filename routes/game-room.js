const express = require('express');
const pool = require('../core/pool');
const path = require('path');
const router = express.Router();
const bodyParser = require('body-parser');
const urlencodedParser = bodyParser.urlencoded({ extended: false });
const dbName = "USE cse442_542_2020_spring_teamc_db; ";
let roomPass = "";
let roomID = "";

// < !--Display Room List-- >
    router.get('/room-list', (req, res) => {
        let user = req.session.user;

        if (user) {

            // Updates gameID of user if not in a game room
            var gameID = 0;
            var sql = 'UPDATE User SET GameID = ? WHERE Username = ?';
            pool.query(sql, [gameID, user.Username], function (err, result) {
                if (err) throw err;
            });

            let initial = dbName;
            sql = "SELECT *  FROM `GameRoom` WHERE `isStarted` = 0 AND `isOver` = 0";
            pool.query(initial, (err, result) => {
                if (err) throw err;
            });

            pool.query(sql, (err, results) => {
                if (err) throw err;
                // res.render('room-list', {results: results, opp:req.session.opp, name:user});

                let user = req.session.user;

                if (user) {
                    let sql = "SELECT * FROM Friendship WHERE UserID1 = ? OR UserID2 = ?";

                    pool.query(dbName, (err, result) => {
                        if (err) throw err;
                    });

                    pool.query(sql, [user['ID'], user['ID']], (err, relationships) => {
                        let friendIDs = [];
                        for (let x = 0; x < relationships.length; x++) {
                            if (relationships[x]['UserID1'] !== user['ID'] && friendIDs.includes(relationships[x]['UserID1']) === false) {
                                friendIDs.push(relationships[x]['UserID1'])
                            } else if (relationships[x]['UserID2'] !== user['ID'] && friendIDs.includes(relationships[x]['UserID2']) === false) {
                                friendIDs.push(relationships[x]['UserID2'])
                            }
                        }

                        if (friendIDs.length > 0) {
                            let sql = "SELECT * FROM User WHERE ";
                            for (let x = 0; x < friendIDs.length; x++) {
                                sql = sql.concat("ID = ", friendIDs[x]);
                                if (x + 1 !== friendIDs.length) {
                                    sql = sql.concat(" OR ");
                                }
                            }

                            pool.query(sql, (err, friends) => {
                                res.render('room-list', {
                                    results: results,
                                    opp: req.session.opp,
                                    user: user,
                                    friends: friends
                                });
                                return;
                            });
                        } else {
                            res.render('room-list', { results: results, opp: req.session.opp, user: user, friends: [] });
                            return;
                        }
                    });
                    return;
                }
                res.redirect('/');
            });
        }
        else {
            res.redirect('/');
        }
    });

    // < !--Insert New Game Room-- >
    router.post('/_create_room', urlencodedParser, (req, res) => {
        let user = req.session.user;

        if (user) {
            let isPrivate;
            let hostID = user.ID;

            if (req.body["private"] === 'on') {
                isPrivate = 1;
            }
            else {
                isPrivate = 0;
            }

            let initial = dbName;
            let newRoom = {
                HostID: hostID,
                RoomName: req.body["room-name"],
                IsPrivate: isPrivate,
                Password: req.body["password"],
                GameMode: req.body["game-mode"],
                PlayerCount: 0,
                PlayerCapacity: req.body["player-capacity"],
                CurrentGame: 'Dodge',
                isStarted: 0,
                isOver: 0,
            };

            sql = "INSERT INTO GameRoom SET ?";

            pool.query(initial, (err, result) => {
                if (err) throw err;
            });

            let query = pool.query(sql, newRoom, (err, result) => {
                if (err) throw err;
                sql = "SELECT * FROM GameRoom WHERE HostID = ? ORDER  BY ID DESC LIMIT 1";

                pool.query(initial, (err, result) => {
                    if (err) throw err;
                });

                query = pool.query(sql, hostID, (err, result) => {
                    if (err) throw err;
                    let roomID = result[0]['ID'];

                    let UserToRoomConnection = {
                        UserID: user.ID,
                        GameRoomID: roomID,
                        Score: 0
                    };

                    sql = "INSERT INTO UserToRoom SET ?";

                    pool.query(initial, (err, none) => {
                        if (err) throw err;
                    });

                    let query = pool.query(sql, UserToRoomConnection, (err, none) => {
                        if (err) throw err;
                        roomPass = req.body["password"];
                        res.redirect('/game/' + result[0]['ID']);
                    });
                });
            });
        }
        else {
            res.redirect('/');
        }
    });

    // < !--Game Room Page-- >
    router.get('/game/:id', (req, res) => {
        let user = req.session.user;
        if (user) {
            roomID = req.params.id;

            let sql = "SELECT * FROM GameRoom WHERE ID = ?";

            pool.query(dbName, (err, result) => {
                if (err) throw err;
            });

            let query = pool.query(sql, roomID, (err, results) => {
                if (results.length === 0) {
                    res.render('error', { errorMsg: "Room Not Found" });
                    return;
                }
                let players = "";
                for (let i = 0; i < results.length; i++) {
                    players += ("SELECT * FROM User WHERE ID = " + results[i]['UserID'] + ';');
                }

                pool.query(players, (err, players) => {
                    let myPlayers = players;
                    pool.query('SELECT * FROM GameRoom WHERE ID = ?;', roomID, (err, result) => {
                        if (err) throw err;
                        let isFull = (result[0].PlayerCount === result[0].PlayerCapacity);
                        let isPrivate = result[0].IsPrivate;
                        let roomPassword = result[0].Password;
                        var join = false;
                        if (!isPrivate && !isFull) {
                            join = true;
                        }
                        else if (isPrivate && !isFull) {
                            if (roomPass === roomPassword) {
                                join = true;
                                roomPass = "";
                            }
                            else if (roomPass !== roomPassword) {
                                if (roomPass === "") {
                                    res.close;
                                }
                                else {
                                    res.render('error', { errorMsg: "You have entered the wrong password!" });
                                    roomPass = "";
                                }
                            }
                        }
                        else if (isFull) {
                            res.render('error', { errorMsg: "The room is full!" });
                        }

                        if (join) {
                            let UserToRoomConnection = {
                                UserID: user.ID,
                                GameRoomID: roomID,
                                Score: 0
                            };

                            sql = "INSERT INTO UserToRoom SET ?";
                            pool.query(sql, UserToRoomConnection, (err, none) => {

                                let playerlist = "";
                                for (let i = 0; i < results.length; i++) {
                                    // Ideally, scraping from this table is better because it is potentially smaller `SELECT * FROM UserToRoom `
                                    playerlist += (`SELECT * FROM User WHERE GameID = ${roomID};`);
                                }
                                pool.query(playerlist, (err, players) => {
                                    console.info(playerlist);
                                    console.info(players);
                                    // console.info(user);
                                    res.render('game-room', { room: result, players: myPlayers, user: user, playerlist: players });

                                });

                            });

                            sql = 'UPDATE User SET GameID = ? WHERE Username = ?';
                            pool.query(sql, [roomID, user.Username], function (err, result) {
                                if (err) throw err;
                            });
                        }
                    });
                });
            });
        }
        else {
            res.redirect('/');
        }
    });

// < !--Room Password Input From User-- >
    router.post('/room-password', urlencodedParser, (req, res) => {
        let path = req['path'];
        roomPass = req.body["room-password"];
        res.redirect('/game/' + roomID);
    });

module.exports = router;