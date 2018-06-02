const ipfsAPI = require('ipfs-api');
const readline = require('readline');
const superagent = require('superagent');
const fs = require('fs');

const interval = 10;
const waitTime = 3000;
const httpEndPoint = "127.0.0.1:10999";
const fileLocation = "snapshot.csv";
const validCID = ''

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

if (validCID != "") {
    var ipfs = ipfsAPI('localhost', '5001', { protocol: 'http' }) // leaving out the arguments will default to these values
    const stream = ipfs.files.getReadableStream(validCID)

    stream.on('data', (file) => {
        // write the file's path and contents to standard out
        console.log(file.path)
        if (file.type !== 'dir') {
            let rl = readline.createInterface({
                input: file.content
            });
            cycle(rl)
        }
    });

}

function retry(account, snapshotBalance, snapshotPublicKey) {
    setTimeout(() => {
        validate(account, snapshotBalance, snapshotPublicKey)
    }, waitTime);

}

function cycle(rl) {
    var count = 0;
    var promises = [];
    rl.on('line', (line) => {
        let arr = line.toString().split(",");
        let account = arr[1].replace(/\"/g, "");
        let snapshotPublicKey = arr[2].replace(/\"/g, "");
        let snapshotBalance = arr[3].replace(/\"/g, "");
        let promise = validate(account, snapshotBalance, snapshotPublicKey)
            .then((res) => {
                console.log(account, res);
                fs.appendFile("good", account + ":" + res + "\n");
                return;
            }).catch((err) => {
                console.error(account, err);
                fs.appendFile("bad", account + ":" + err + "\n");
                return;
            })
        promises.push(promise);
        count += 1;
        if (count == interval) {
            rl.pause();
            count = 0;
            Promise.all(promises)
            .then(()=>{
                promises = [];
                rl.resume();
            });
        }
    });
}

function validate(account, snapshotBalance, snapshotPublicKey) {
    //let vaild = true;
    snapshotBalance = snapshotBalance.toString().split(" ")[0];
    return new Promise((resolve, reject) => {
        superagent(httpEndPoint + "/v1/chain/get_currency_balance")
            .set('Content-Type', 'application/json')
            .send({
                "code": "eosio.token",
                "account": account,
                "symbol": "EOS"
            })
            .end(function (err, res) {
                if (err) {
                    console.error("http error :" + err);
                    retry(account, snapshotBalance, snapshotPublicKey);
                } else if (res.statusCode != 200) {
                    console.error("status code :" + res.statusCode);
                    retry(account, snapshotBalance, snapshotPublicKey);
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
                                retry(account, snapshotBalance, snapshotPublicKey);
                            } else if (res.statusCode != 200) {
                                console.error("status code :" + res.statusCode);
                                retry(account, snapshotBalance, snapshotPublicKey);
                            } else {
                                let object = JSON.parse(res.text);
                                let stake_cpu = 1 * object.total_resources.cpu_weight.toString().split(" ")[0];;
                                let stake_net = 1 * object.total_resources.net_weight.toString().split(" ")[0];;
                                let ram_bytes = object.total_resources.ram_bytes;
                                let owner_key = object.permissions[0].required_auth.keys[0].key;
                                let active_key = object.permissions[1].required_auth.keys[0].key;
                                if (owner_key != snapshotPublicKey || active_key != snapshotPublicKey) {
                                    //console.error("snapshotPublicKey error");
                                    reject("snapshotPublicKey error,snapshot:" + snapshotPublicKey + ",owner:" + owner_key + ",active:" + active_key);
                                }
                                if (ram_bytes > 8192) {
                                    //console.error("ram error");
                                    reject("ram error,ram:" + ram_bytes);
                                }
                                let total = (balance + stake_cpu + stake_net).toFixed(4);
                                if (total != snapshotBalance) {
                                    //console.error("balance error");
                                    reject("balance error,snapshot:" + snapshotBalance + " , total:" + total + ",balance:" + balance + ",stake_cpu:" + stake_cpu + ",stake_net:" + stake_net);
                                }
                                resolve(":ok.");
                            }
                        }
                        )
                }
            });
    });

}
