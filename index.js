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

/* function retry(account, snapshotBalance, snapshotPublicKey) {
    setTimeout(() => {
        validate(account, snapshotBalance, snapshotPublicKey)
    }, waitTime);

} */

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
/* validate(account, snapshotBalance, snapshotPublicKey)
    .then((res) => {
        console.log(account, res);
        fs.appendFile("good", account + ":" + res + "\n", () => { });
        return;
    }).catch((err) => {
        console.error(account, err);
        fs.appendFile("bad", account + ":" + err + "\n", () => { });
        return;
    })
count += 1;
if (count == interval) {
    rl.pause();
    count = 0;
    setTimeout(() => {
        rl.resume();
    }, waitTime);
} */

/* 
function validate(list){
    async.mapLimit(list,3,function(object,callback){
        superagent.get(url)
            .end(function(err,mes){
                if(err){
                    console.error(err);
                    console.log('message info ' + JSON.stringify(mes));
                }
                console.log('「fetch」' + url + ' successful！');
                var $ = cheerio.load(mes.text);
                var jsonData = {
                    title:$('.post-card-title').text().trim(),
                    href: url,
                };
                callback(null,jsonData);
            },function(error,results){
                console.log('results ');
                console.log(results);
            })
        })
} */

function validate(account, snapshotBalance, snapshotPublicKey, callback) {
    //let vaild = true;
    snapshotBalance = snapshotBalance.toString().split(" ")[0];
    let random = Math.floor(Math.random() * 4);
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
                console.error("http error :" + err);
                //retry(account, snapshotBalance, snapshotPublicKey);
            } else if (res.statusCode != 200) {
                console.error("status code :" + res.statusCode);
                //retry(account, snapshotBalance, snapshotPublicKey);
            } else {
                //console.log(res.text);
                let balance = 0;
                let balanceArr = JSON.parse(res.text);
                if (balanceArr.length != 0) {
                    balance = 1 * balanceArr[0].toString().split(" ")[0];
                }
                superagent(httpEndPoint + "/v1/chain/get_account")
                    .set('Content-Type', 'application/json')
                    .send({
                        "account_name": account,
                    })
                    .end(function (err, res) {
                        if (err) {
                            console.error("http error :" + err);
                            //retry(account, snapshotBalance, snapshotPublicKey);
                        } else if (res.statusCode != 200) {
                            console.error("status code :" + res.statusCode);
                            //retry(account, snapshotBalance, snapshotPublicKey);
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
                                console.error(msg);
                                msg += '\n';
                                fs.appendFile("bad", msg, () => { });
                            } else if (ram_bytes > 8192) {
                                let msg = "ram error,ram:" + ram_bytes;
                                console.error(msg);
                                msg += '\n';
                                fs.appendFile("bad", msg, () => { });
                            } else if (total != snapshotBalance) {
                                let msg = "balance error,snapshot:" + snapshotBalance + " , total:" + total + ",balance:" + balance + ",stake_cpu:" + stake_cpu + ",stake_net:" + stake_net;
                                console.error(msg);
                                msg += '\n';
                                fs.appendFile("bad", msg, () => { });
                            } else {
                                let msg = account + ":ok.";
                                console.log(msg);
                                msg += '\n';
                                fs.appendFile("good", msg, () => { });
                            }
                            callback(null, null);
                        }
                    }
                    )
            }
        });

}