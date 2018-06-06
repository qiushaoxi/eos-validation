# eos-validation

this tool will compare snapshot.csv with onchian data.

snapshot balance = account balance + stackd cpu + stack bandwith

ram < 8k

stackd cpu = stackd bandwith

snapshot public key = account public key

## how to run

npm install

change endpoints and port in config.ini , you can speed up by config more endpoints, but same port.

use latest snapshot.csv

node index.js
