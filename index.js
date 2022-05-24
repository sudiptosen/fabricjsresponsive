let connect = require('connect');
let serveStatic = require('serve-static');

let app = connect();
app.use(serveStatic(__dirname));
app.listen(3000);
