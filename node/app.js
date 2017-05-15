var express         = require('express');
var bodyParser      = require('body-parser');
var session         = require('express-session');
var partials        = require('express-partials');
var favicon         = require('serve-favicon');
var path            = require('path');
var http            = require('http');
var winston         = require('winston');
var sassMiddleware  = require('node-sass-middleware');
var bourbon         = require('node-bourbon');
var fs              = require('fs');
var sqlite3         = require('sqlite3').verbose();
var moment          = require('moment');
var hat             = require('hat');
var twilioLibrary   = require('twilio');
var async           = require('async');
var events          = require('events');
var event           = new events.EventEmitter();

// = Winston Setup =
winston.remove(winston.transports.Console);
winston.add(winston.transports.Console, {level: 'debug', colorize: true});
winston.addColors({ info: 'blue', error: 'red' });

// = Errors =
process.on('uncaughtException', function (err) {
  // Exit
  winston.error('Uncaught Error:', err);
  process.exit();
});

// = Config =
var config = require('./config/config');

// = Twilio =
var twilio = new twilioLibrary.Twilio(config.twilio.account_sid, config.twilio.auth_token);

// = DB connect
var db_exists = fs.existsSync(config.sqlite3);
if(!db_exists) {
  console.log("Creating DB file.");
  fs.openSync(config.sqlite3, "w");
}
var db = new sqlite3.Database(config.sqlite3);
if(!db_exists) {
  db.serialize(function() {
    db.run("CREATE TABLE devices (id INTEGER primary key autoincrement, name TEXT, twilio_sid TEXT, address_line TEXT, city TEXT, state TEXT, zip TEXT, token TEXT, created_at TIMESTAMP)");
    db.run("CREATE TABLE bean_data (id integer primary key autoincrement, device_id INTEGER, weight NUMERIC, temp NUMERIC, humidity NUMERIC, created_at TIMESTAMP, FOREIGN KEY(device_id) REFERENCES devices(id))");
  });
}


// = Express =
var app = express();
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');
app.use(favicon(__dirname + '/public/imgs/favicon.ico'));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(partials());
app.use(require('express-session')({
  secret: 'plokijuhygtfrdesw',
  cookie: { maxAge: 1000 * 60 * 60 * 24 * 7 }
}));
app.use(
  sassMiddleware({
    src: path.join(__dirname, 'public'),
    dest: path.join(__dirname, 'public'),
    outputStyle: 'nested',
    imagePath: path.join(__dirname, 'public', 'images'),
    includePaths: bourbon.with(path.join(__dirname, 'public', 'cssf'))
  })
);
app.use(express.static(path.join(__dirname, 'public')));

var server = http.createServer(app).listen(process.env.PORT || 8080, function () {
  winston.info('Web | Ready | Port:', server.address().port);
});

// = Routes =
app.get('/', function(req, res) {
  db.all("Select * from devices",  function (error, rows) {
    if (error || typeof rows == 'undefined' || rows.length <= 0) {
      winston.error(error);
      res.render('index', { devices: [], chart_data: {}, page: "dash" });
    } else {
      var devices = rows;
      var db_calls = [];
      for(var i=0; i<devices.length; i++) {
        var call = function(callback) {
          db.all("Select * from bean_data where device_id = ? order by created_at DESC limit 15", [devices[0].id],  function (error, rows) {
            if (error || typeof rows == 'undefined' && rows.length <= 0) {
              winston.error(error);
              callback("chart_data error");
            }

            var chart_data = { weight: [], temp: [], humidity: [] };
            for(var i=0; i<rows.length; i++) {
              chart_data.weight.push( { x: rows[i].created_at, y: rows[i].weight } );
              chart_data.temp.push( { x: rows[i].created_at, y: rows[i].temp } );
              chart_data.humidity.push( { x: rows[i].created_at, y: rows[i].humidity } );

              if(i == 0) {
                devices[0].active = false;
                if (moment().diff(moment(rows[i].created_at), "minutes") <= 1 ) {
                  devices[0].active = true;
                }
              }
            }
            callback(null, chart_data);
          });
        }
      }
      db_calls.push(call);
    }
    async.parallel(db_calls,
      function(err, results) {
        if(err) {
          winston.error(err);
          res.render('index', { devices: [], chart_data: {}, page: "dash" });
        } else {
          res.render('index', { devices: devices, chart_data: results, page: "dash" });
        }
      });
  });
});

app.get('/bean-counter/:id', function(req, res) {
  var id = req.params.id
  db.all("Select * from devices where id=?", [id],  function (error, rows) {
    if (error || typeof rows == 'undefined' || rows.length <= 0) {
      winston.error(error);
      res.redirect('/')
    } else {
      var device = rows[0];
      var device_sid = rows[0].twilio_sid;
      async.parallel([
        function(callback) {
          db.all("Select * from bean_data where device_id = ? order by created_at DESC limit 15", [device.id],  function (error, rows) {
            if (error || typeof rows == 'undefined' || rows.length < 0) {
              winston.error(error);
              callback("chart_data error", null);
            } else {
              chart_data = { weight: [], temp: [], humidity: [] };
              for(var i=0; i<rows.length; i++) {
                chart_data.weight.push( { x: rows[i].created_at, y: rows[i].weight } );
                chart_data.temp.push( { x: rows[i].created_at, y: rows[i].temp } );
                chart_data.humidity.push( { x: rows[i].created_at, y: rows[i].humidity } );
              }
              callback(null, chart_data);
            }
          });
        },
        function(callback) {
          db.all("Select * from bean_data where device_id = ? and created_at > ( datetime('now', '-1 hour') )", [device.id],  function (error, rows) {
            if (error || typeof rows == 'undefined' || rows.length < 0) {
              winston.debug(error);
              callback("avgs error", null);
            } else {
              var avgs = {
                weight: 0,
                temp: 0,
                humidity: 0
              }
              if(rows.length>0) {
                for(var i=0; i<rows.length; i++) {
                  avgs.weight += rows[i].weight;
                  avgs.temp += rows[i].temp;
                  avgs.humidity += rows[i].humidity;
                }

                avgs.weight = (avgs.weight/rows.length).toFixed(2);
                avgs.temp = (avgs.temp/rows.length).toFixed(2);
                avgs.humidity = (avgs.humidity/rows.length).toFixed(2);
              }
              callback(null, avgs);
            }
          });
        },
        function(callback) {
          twilio.preview.wireless.sims(device_sid)
            .fetch(function(err, device) {
              if(err) {
                callback("twilio devices failed", null);
              }
              callback(null, { "date_created": device.date_created, "status": device.status, "twilio_url": device.url })
          });
        },
        function(callback) {
          var callbackCalled = false;
          twilio.preview.wireless.sims(device_sid).usage().fetch({
            "start": moment().startOf('month').format(),
            "end": moment().endOf('month').format()
          }, function(err, usage) {
            if(err || !usage) {
              callback("Data useage error", null);
            }

            if(!callbackCalled) {
              callback(null, {
                "data": {
                  "sent": usage.dataUsage.sent,
                  "recieved": usage.dataUsage.received,
                  "total": usage.dataUsage.total,
                  "cost": usage.dataCosts.total
                },
                "commands": {
                  "sent": usage.commandsUsage.sent,
                  "recieved": usage.commandsUsage.received,
                  "total": usage.commandsUsage.total,
                  "cost": usage.commandsCosts.total
                }
              });
              callbackCalled = true;
            }
          });

          // twilio API not returning -- add timeout for testing.
          setTimeout(function() {
            if(!callbackCalled) {
              callback(null, {
                "data": {
                  "sent": 0,
                  "recieved": 0,
                  "total": 0,
                  "cost": 0
                },
                "commands": {
                  "sent": 0,
                  "recieved": 0,
                  "total": 0,
                  "cost": 0
                }
              });
              callbackCalled = true;
            }
          }, 5000);

        }
      ], function(err, results) {
        if(err) {
          winston.error(err);
          res.redirect('/');
        } else {
          device_info = {
            "avgs": results[0],
            "date_created": results[1].date_created,
            "device_status": results[1].status
          };
          res.render('device_info', { device: device, chart_data: results[0], avgs: results[1], device_info: results[2], twilio_data: results[3], page: "device_info" });
        }
      });
    }
  });
});

app.get('/bean-counters', function(req, res) {
  db.all("Select * from devices",  function (error, rows) {
    if (error || typeof rows == 'undefined' || rows.length <= 0) {
      winston.error(error);
      res.render('device_list', { devices: [], error: "database error", page: "list" });
    } else {
      res.render('device_list', { devices: rows, moment: moment, page: "list" });
    }
  });
});

app.post('/add-device', function(req, res) {
  var name = req.body.name.replace(/'/g, "\\'");
  var twilio_sid = req.body.twilio_sid;
  var address_line = req.body.address_line;
  var city = req.body.city;
  var state = req.body.state;
  var zip = req.body.zip;
  var token = hat();
  // check twilio for SIM SID correctness
  twilio.preview.wireless.sims(twilio_sid).fetch(function(err, device) {
    if(err) {
      winston.error(err);
      res.redirect('/bean-counters');
    } else {
      // enter it
      db.run("INSERT INTO devices (name, twilio_sid, address_line, city, state, zip, token, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)", [name, twilio_sid, address_line, city, state, zip, token, moment().format()],  function (error) {
        if (error) {
          winston.error(error);
          res.render('device_list', { devices: [], error: "database error", page: "list" });
        } else {
          // change twilio alias to SIM name
          twilio.preview.wireless.sims(twilio_sid).update({
            "alias": name
          }, function(err, device) {});
          res.redirect('/bean-counters');
        }
      });
    }
  });
});

app.post('/device/:id/edit', function(req, res) {
  var id = req.params.id
  var name = req.body.name.replace(/'/g, "\\'");
  var twilio_sid = req.body.twilio_sid;
  var address_line = req.body.address_line
  var city = req.body.city
  var state = req.body.state
  var zip = req.body.zip
  var token = hat();
  db.run("UPDATE devices SET name=?, twilio_sid=?, address_line=?, city=?, state=?, zip=? WHERE id=?", [name, twilio_sid, address_line, city, state, zip, id],  function (error) {
    if (error) {
      winston.error(error);
      res.redirect('/bean-counter/'+id);
    } else {
      res.redirect('/bean-counter/'+id);
    }
  });
});

app.get('/delete-device/:id', function(req, res) {
  var id = req.params.id
  db.run("DELETE FROM bean_data where device_id=?", [id],  function (error) {
    db.run("DELETE FROM devices where id=?", [id],  function (error) {
      if (error) {
        winston.error(error);
        res.redirect('/device/'+id);
      } else {
        res.redirect('/device/'+id);
      }
    });
  });
});

app.post('/api/data', checkToken, function(req, res) {
  var device_name = req.body.device_name;
  var weight = req.body.weight;
  var temp = req.body.temp;
  var humidity = req.body.humidity;
  if(device_name == null || weight == null || temp == null || humidity == null) {
    return res.json({success: false, error: 'malformed data'});
  } else {
    // no full outer join in sqlite
    db.all("Select * from devices WHERE LOWER(devices.name) = ? limit 1", [device_name.toLowerCase()],  function (error, rows) {
      if (error || typeof rows == 'undefined' || rows.length <= 0) {
        winston.debug("select database error");
        res.json({ success: false, error: "database error" });
      } else {
        db.run('INSERT INTO bean_data (device_id, weight, temp, humidity, created_at) VALUES(?, ?, ?, ?, ?)', [rows[0].id, weight, temp, humidity, moment().format()], function (error) {
          if (error) {
            winston.debug("insert database error");
            res.json({ success: false, error: "database error" });
          } else {
            winston.debug("inserted bean data -- name: "+device_name+" weight: "+weight+" temp: "+temp+" humidity: "+humidity);
            app_socket.emit('new:bean-data', {
              device_id: rows[0].id,
              weight: {x: moment(), y: weight },
              temp: {x: moment(), y: temp },
              humidity: {x: moment(), y: humidity }
            });
            res.json({ "success": true, "message": "data entered" });
          }
        });
      }
    });
  }
});

// token per device
function checkToken(req, res, next) {
  var device_name = req.body.device_name;
  var request_token = req.body.token;
  db.all("Select * from devices where LOWER(name) = ? limit 1", [device_name.toLowerCase()],  function (error, rows) {
    if(rows && rows[0] && (rows[0].token == request_token)) {
      next();
    } else {
      winston.debug("permission denied");
      res.json({ "success": false, "error": "permission denied" });
    }
  });
}

// 404 Catch-all
app.use(function (req, res, next) {
  res.status(404);
  winston.error('Page not found:', req.url);
  res.redirect('/');
});

// = App Socket =
var io = require('socket.io')({
  'port': server.address().port,
  'heartbeat interval': 2000,
  'heartbeat timeout' : 3000
});

io.listen(server);

var app_socket = io.of('/beans');
app_socket.on('connection', function(socket) {
  winston.info("=== SERVER ===", "SITE CONNECTED");

  socket.on('disconnect', function(){
    winston.info("=== SERVER ===", "APP DISCONNECTED");
  });
});