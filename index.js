const readline = require('readline');
const superagent = require('superagent');
const fs = require('fs');
const async = require('async');
const config = require('./config.json');

const httpEndPoints = config.httpEndPoints;
const port = config.port;
const fileLocation = config.fileLocation;
const connection = config.connection;

if (fs.existsSync("good")) {
    fs.unlinkSync("good");
}

if (fs.existsSync("bad")) {
    fs.unlinkSync("bad");
}

if (fileLocation != "") {
    let rl = readline.createInterface({
        input: fs.createReadStream(fileLocation)
    });
    cycle(rl)
}


function cycle(rl) {
    var count = 0;
    var list = [];
    var paused = true;
    rl.on('line', (line) => {
        let arr = line.toString().split(",");
        let account = arr[1].replace(/\"/g, "");
        let snapshotPublicKey = arr[2].replace(/\"/g, "");
        let snapshotBalance = arr[3].replace(/\"/g, "");
        list[count] = [account, snapshotPublicKey, snapshotBalance];
        count += 1;
    }).on('close', () => {
        async.mapLimit(list, connection, (object, callback) => {
            let account = object[0];
            let snapshotPublicKey = object[1];
            let snapshotBalance = object[2];
            validate(account, snapshotBalance, snapshotPublicKey, callback);
        }, (err, res) => {
            console.error(err);
            console.error(res);
        });
    });
}

function log(account, file, msg) {
    msg = account + ":" + msg
    console.log(msg);
    msg += '\n';
    fs.appendFile(file, msg, () => { });
}

function validate(account, snapshotBalance, snapshotPublicKey, callback) {
    snapshotBalance = snapshotBalance.toString().split(" ")[0];
    let random = Math.floor(Math.random() * httpEndPoints.length);
    let httpEndPoint = httpEndPoints[random];
    superagent(httpEndPoint + ":" + port + "/v1/chain/get_currency_balance")
        .set('Content-Type', 'application/json')
        .send({
            "code": "eosio.token",
            "account": account,
            "symbol": "EOS"
        })
        .end(function (err, res) {
            if (err) {
                let msg = httpEndPoint + " , http error :" + err;
                log(account, "bad", msg);
            } else if (res.statusCode != 200) {
                let msg = httpEndPoint + " status code :" + res.statusCode
                log(account, "bad", msg);
            } else {
                let balance = 0;
                let balanceArr = JSON.parse(res.text);
                if (balanceArr.length != 0) {
                    balance = 1 * balanceArr[0].toString().split(" ")[0];
                }
                superagent(httpEndPoint + ":" + port + "/v1/chain/get_account")
                    .set('Content-Type', 'application/json')
                    .send({
                        "account_name": account,
                    })
                    .end(function (err, res) {
                        if (err) {
                            let msg = httpEndPoint + " , http error :" + err;
                            log(account, "bad", msg);
                        } else if (res.statusCode != 200) {
                            let msg = httpEndPoint + " status code :" + res.statusCode
                            log(account, "bad", msg);
                        } else {
                            let object = JSON.parse(res.text);
                            let stake_cpu = 1 * object.total_resources.cpu_weight.toString().split(" ")[0];;
                            let stake_net = 1 * object.total_resources.net_weight.toString().split(" ")[0];;
                            let ram_bytes = object.total_resources.ram_bytes;
                            let owner_key = object.permissions[0].required_auth.keys[0].key;
                            let active_key = object.permissions[1].required_auth.keys[0].key;
                            let total = (balance + stake_cpu + stake_net).toFixed(4);

                            if (owner_key != snapshotPublicKey || active_key != snapshotPublicKey) {
                                let msg = "snapshotPublicKey error,snapshot:" + snapshotPublicKey + ",owner:" + owner_key + ",active:" + active_key;
                                log(account, "bad", msg);
                            } else if (ram_bytes > 8192) {
                                let msg = "ram error,ram:" + ram_bytes;
                                log(account, "bad", msg);
                            } else if (total != snapshotBalance) {
                                let msg = "balance error,snapshot:" + snapshotBalance + " , total:" + total + ",balance:" + balance + ",stake_cpu:" + stake_cpu + ",stake_net:" + stake_net;
                                log(account, "bad", msg);
                            } else if (balance > 10) {
                                let msg = "balance error, > 10 EOS";
                                log(account, "bad", msg);
                            } else {
                                let msg = "ok.";
                                log(account, "good", msg);
                            }
                        }
                    }
                    )
            }
            callback(null, null);
        });

}