# Los Santos Life RP
Dev: Axelz | Helper: gergree

Run locally: `npm install && npm start` then open http://localhost:3000
Deploy: push to GitHub, then on Render create a New Web Service from the repo (Node, build `npm install`, start `node server.js`).
Accounts are stored in db.json. Add a Render Disk and set DATA_FILE=/var/data/db.json so accounts survive redeploys.
